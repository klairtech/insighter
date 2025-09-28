import { supabaseServer } from './server-utils'

/**
 * Convert tokens to credits based on environment variable
 * Rounds tokens to nearest multiple of TOKENS_PER_CREDIT before calculating credits
 */
export function tokensToCredits(tokens: number): number {
  const tokensPerCredit = parseInt(process.env.TOKENS_PER_CREDIT || '1000')
  // Round tokens to nearest multiple of tokensPerCredit
  const roundedTokens = Math.ceil(tokens / tokensPerCredit) * tokensPerCredit
  return roundedTokens / tokensPerCredit
}

/**
 * Get rounded tokens for display purposes
 */
export function getRoundedTokens(tokens: number): number {
  const tokensPerCredit = parseInt(process.env.TOKENS_PER_CREDIT || '1000')
  return Math.ceil(tokens / tokensPerCredit) * tokensPerCredit
}

/**
 * Deduct credits from user's account
 */
export async function deductCredits(
  userId: string, 
  creditsToDeduct: number,
  description: string = 'AI Agent Usage'
): Promise<{ success: boolean; error?: string; remainingCredits?: number }> {
  try {
    console.log(`💳 Deducting ${creditsToDeduct} credits from user ${userId} for: ${description}`)
    
    // Call the database function to deduct credits
    const { data, error } = await supabaseServer.rpc('deduct_user_credits', {
      p_user_id: userId,
      p_credits_to_deduct: creditsToDeduct,
      p_description: description
    })

    console.log('🔍 Credit deduction response:', { data, error })

    if (error) {
      console.error('❌ Credit deduction error:', error)
      return { 
        success: false, 
        error: `Failed to deduct credits: ${error.message}` 
      }
    }

    if (!data) {
      console.error('❌ Credit deduction failed: No data returned')
      return { 
        success: false, 
        error: 'Credit deduction failed: No data returned' 
      }
    }

    // Handle different possible return structures
    let remainingCredits: number | undefined
    
    if (typeof data === 'object' && data !== null) {
      // Check for different possible field names
      remainingCredits = data.remaining_credits || data.remainingCredits || data.total_credits || data.balance
    } else if (typeof data === 'number') {
      // If the function returns just a number
      remainingCredits = data
    }

    // If we still don't have remaining credits, try to get it from the balance API
    if (remainingCredits === undefined) {
      console.log('🔍 No remaining credits from deduction function, fetching from balance API')
      try {
        const balanceResult = await checkUserCredits(userId, 0)
        if (balanceResult.currentCredits !== undefined) {
          remainingCredits = balanceResult.currentCredits
          console.log(`✅ Got remaining credits from balance API: ${remainingCredits}`)
        }
      } catch (balanceError) {
        console.warn('⚠️ Failed to get remaining credits from balance API:', balanceError)
      }
    }

    console.log(`✅ Successfully deducted ${creditsToDeduct} credits. Remaining: ${remainingCredits}`)
    
    return {
      success: true,
      remainingCredits: remainingCredits
    }

  } catch (error) {
    console.error('❌ Credit deduction error:', error)
    return { 
      success: false, 
      error: `Credit deduction failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

/**
 * Check if user has sufficient credits
 */
export async function checkUserCredits(
  userId: string, 
  requiredCredits: number
): Promise<{ hasCredits: boolean; currentCredits: number; error?: string }> {
  try {
    console.log(`💳 Checking credits for user ${userId}. Required: ${requiredCredits}`)
    
    // Call the database function to get user's credit balance
    const { data, error } = await supabaseServer.rpc('get_user_credit_balance', {
      p_user_id: userId
    })

    if (error) {
      console.error('❌ Credit check error:', error)
      return { 
        hasCredits: false, 
        currentCredits: 0,
        error: `Failed to check credits: ${error.message}` 
      }
    }

    const currentCredits = data?.total_credits || 0
    const hasCredits = currentCredits >= requiredCredits

    console.log(`💳 User ${userId} has ${currentCredits} credits. Required: ${requiredCredits}. Has enough: ${hasCredits}`)
    
    return {
      hasCredits,
      currentCredits
    }

  } catch (error) {
    console.error('❌ Credit check error:', error)
    return { 
      hasCredits: false, 
      currentCredits: 0,
      error: `Credit check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

/**
 * Calculate credits needed for a given token count
 */
export function calculateCreditsForTokens(tokens: number): number {
  return tokensToCredits(tokens)
}

/**
 * Log credit usage for analytics
 */
export async function logCreditUsage(
  userId: string,
  agentId: string,
  conversationId: string,
  tokensUsed: number,
  creditsUsed: number,
  description: string = 'AI Agent Usage'
): Promise<void> {
  try {
    console.log(`📊 Logging credit usage: User ${userId}, Agent ${agentId}, ${tokensUsed} tokens, ${creditsUsed} credits`)
    
    // Get the active credit batch for this user
    const { data: activeBatch, error: batchError } = await supabaseServer
      .from('insighter_credit_batches')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('credits_remaining', 0)
      .order('added_date', { ascending: false })
      .limit(1)
      .single()

    if (batchError || !activeBatch) {
      console.error('❌ Error finding active credit batch:', batchError)
      return
    }

    // Store in insighter_credit_usage table
    const { error } = await supabaseServer
      .from('insighter_credit_usage')
      .insert({
        user_id: userId,
        batch_id: activeBatch.id,
        credits_used: creditsUsed,
        operation_type: 'chat_interaction',
        operation_id: conversationId,
        description: description
      })

    if (error) {
      console.error('❌ Error storing credit usage:', error)
    } else {
      console.log(`✅ Credit usage logged: ${creditsUsed} credits for user ${userId}`)
    }

    // Also store token usage in token_usage table
    const { error: tokenError } = await supabaseServer
      .from('token_usage')
      .insert({
        user_id: userId,
        tokens_used: tokensUsed,
        action: 'chat'
      })

    if (tokenError) {
      console.error('❌ Error storing token usage:', tokenError)
    } else {
      console.log(`✅ Token usage logged: ${tokensUsed} tokens for user ${userId}`)
    }

  } catch (error) {
    console.error('❌ Error logging credit usage:', error)
    // Don't throw error for logging failures
  }
}
