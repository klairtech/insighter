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
    
    // The function returns an array with the result object
    const result = Array.isArray(data) ? data[0] : data
    
    if (typeof result === 'object' && result !== null) {
      // Check for different possible field names
      remainingCredits = result.remaining_credits || result.remainingCredits || result.total_credits || result.balance
      
      // Also check if the result has success field to validate the operation
      if (result.success === false) {
        console.error('❌ Credit deduction failed:', result.error || result.error_message)
        return { 
          success: false, 
          error: result.error || result.error_message || 'Credit deduction failed' 
        }
      }
    } else if (typeof result === 'number') {
      // If the function returns just a number
      remainingCredits = result
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
 * @deprecated Use checkUserCredits from @/lib/credit-service instead
 */
export async function checkUserCredits(
  userId: string, 
  requiredCredits: number
): Promise<{ hasCredits: boolean; currentCredits: number; error?: string }> {
  // Use centralized credit service
  const { checkUserCredits: centralizedCheck } = await import('./credit-service-server');
  return centralizedCheck(userId, requiredCredits);
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
  description: string = 'AI Agent Usage',
  modelInfo?: {
    model_used: string;
    model_provider: string;
    model_version: string;
    fallback_used: boolean;
    input_tokens: number;
    output_tokens: number;
  }
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
        action: 'chat',
        model_used: modelInfo?.model_used,
        model_provider: modelInfo?.model_provider,
        model_version: modelInfo?.model_version,
        fallback_used: modelInfo?.fallback_used || false,
        input_tokens: modelInfo?.input_tokens,
        output_tokens: modelInfo?.output_tokens,
        metadata: {
          agent_id: agentId,
          conversation_id: conversationId,
          description: description,
          model_info: modelInfo
        }
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
