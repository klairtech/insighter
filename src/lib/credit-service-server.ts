import { createServerSupabaseClient } from './server-utils';

/**
 * Server-only credit service - single source of truth for all credit calculations
 * This ensures consistency across all server-side components and APIs
 */

export interface CreditBalance {
  balance: number;
  total_purchased: number;
  total_used: number;
  batches: Array<{
    id: string;
    credits_added: number;
    credits_used: number;
    credits_remaining: number;
    batch_type: string;
    added_date: string;
    expiry_date: string;
  }>;
}

export interface CreditCheckResult {
  hasCredits: boolean;
  currentCredits: number;
  error?: string;
}

/**
 * Get user's credit balance - SINGLE SOURCE OF TRUTH (Server-only)
 * All server-side components should use this function instead of direct database queries
 */
export async function getUserCreditBalance(userId: string): Promise<CreditBalance> {
  try {
    console.log(`💳 Getting credit balance for user: ${userId}`);
    
    // Use the same Supabase client for consistency
    const supabase = await createServerSupabaseClient();
    
    // Query insighter_credit_batches table
    const { data: creditBatches, error: batchError } = await supabase
      .from('insighter_credit_batches')
      .select('id, credits_added, credits_used, credits_remaining, batch_type, added_date, expiry_date')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('credits_remaining', 0);

    if (batchError) {
      console.error('❌ Error fetching credit batches:', batchError);
      throw new Error(`Failed to fetch credit balance: ${batchError.message}`);
    }

    // Calculate totals
    const totalCredits = creditBatches?.reduce((sum, batch) => sum + batch.credits_added, 0) || 0;
    const totalUsed = creditBatches?.reduce((sum, batch) => sum + batch.credits_used, 0) || 0;
    let currentBalance = creditBatches?.reduce((sum, batch) => sum + batch.credits_remaining, 0) || 0;

    // Fallback: If no data in insighter_credit_batches, check user_credits table
    if (currentBalance === 0 && (!creditBatches || creditBatches.length === 0)) {
      console.log('🔍 No data in insighter_credit_batches, checking user_credits table as fallback');
      const { data: userCredits, error: fallbackError } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (fallbackError) {
        console.error("Error fetching user credits from user_credits:", fallbackError);
      } else {
        currentBalance = userCredits?.balance || 0;
        console.log('🔍 Fallback credit balance from user_credits:', currentBalance);
      }
    }

    console.log('💳 Credit balance calculated:', {
      userId,
      creditBatchesCount: creditBatches?.length || 0,
      currentBalance,
      totalCredits,
      totalUsed
    });

    return {
      balance: currentBalance,
      total_purchased: totalCredits,
      total_used: totalUsed,
      batches: creditBatches || []
    };

  } catch (error) {
    console.error('❌ Error in getUserCreditBalance:', error);
    return {
      balance: 0,
      total_purchased: 0,
      total_used: 0,
      batches: []
    };
  }
}

/**
 * Check if user has sufficient credits - SINGLE SOURCE OF TRUTH (Server-only)
 * All server-side credit checks should use this function
 */
export async function checkUserCredits(
  userId: string, 
  requiredCredits: number
): Promise<CreditCheckResult> {
  try {
    console.log(`💳 Checking credits for user ${userId}. Required: ${requiredCredits}`);
    
    const creditBalance = await getUserCreditBalance(userId);
    const hasCredits = creditBalance.balance >= requiredCredits;

    console.log(`💳 User ${userId} has ${creditBalance.balance} credits. Required: ${requiredCredits}. Has enough: ${hasCredits}`);
    
    return {
      hasCredits,
      currentCredits: creditBalance.balance
    };

  } catch (error) {
    console.error('❌ Error in checkUserCredits:', error);
    return { 
      hasCredits: false, 
      currentCredits: 0,
      error: `Credit check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Convert tokens to credits based on environment variable
 */
export function tokensToCredits(tokens: number): number {
  const tokensPerCredit = parseInt(process.env.TOKENS_PER_CREDIT || '1000');
  const roundedTokens = Math.ceil(tokens / tokensPerCredit) * tokensPerCredit;
  return roundedTokens / tokensPerCredit;
}

/**
 * Get rounded tokens for display purposes
 */
export function getRoundedTokens(tokens: number): number {
  const tokensPerCredit = parseInt(process.env.TOKENS_PER_CREDIT || '1000');
  return Math.ceil(tokens / tokensPerCredit) * tokensPerCredit;
}
