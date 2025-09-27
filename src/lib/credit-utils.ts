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

    if (error) {
      console.error('❌ Credit deduction error:', error)
      return { 
        success: false, 
        error: `Failed to deduct credits: ${error.message}` 
      }
    }

    if (!data || data.remaining_credits === null) {
      console.error('❌ Credit deduction failed: No data returned')
      return { 
        success: false, 
        error: 'Credit deduction failed: No data returned' 
      }
    }

    console.log(`✅ Successfully deducted ${creditsToDeduct} credits. Remaining: ${data.remaining_credits}`)
    
    return {
      success: true,
      remainingCredits: data.remaining_credits
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
    
    // This could be stored in a separate analytics table
    // For now, we'll just log it
    console.log(`📊 Credit Usage Log:`, {
      userId,
      agentId,
      conversationId,
      tokensUsed,
      creditsUsed,
      description,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error logging credit usage:', error)
    // Don't throw error for logging failures
  }
}
