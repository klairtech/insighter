import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function GET() {
  try {
    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch credit batches with detailed information
    const { data: creditBatches, error: batchError } = await supabase
      .from('insighter_credit_batches')
      .select(`
        id,
        batch_code,
        credits_added,
        credits_used,
        credits_remaining,
        batch_type,
        plan_type,
        added_date,
        expiry_date,
        is_active,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .order('added_date', { ascending: false });

    if (batchError) {
      console.error("Database error:", batchError);
      return NextResponse.json(
        { error: "Failed to fetch credit statement" },
        { status: 500 }
      );
    }

    // Fetch credit usage history
    const { data: creditUsage, error: usageError } = await supabase
      .from('insighter_credit_usage')
      .select(`
        id,
        batch_id,
        credits_used,
        operation_type,
        operation_id,
        description,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100); // Limit to last 100 usage records

    if (usageError) {
      console.error("Usage error:", usageError);
      return NextResponse.json(
        { error: "Failed to fetch credit usage" },
        { status: 500 }
      );
    }

    // Calculate summary statistics
    const totalCreditsAdded = creditBatches?.reduce((sum, batch) => sum + batch.credits_added, 0) || 0;
    const totalCreditsUsed = creditBatches?.reduce((sum, batch) => sum + batch.credits_used, 0) || 0;
    const totalCreditsRemaining = creditBatches?.reduce((sum, batch) => 
      batch.is_active && new Date(batch.expiry_date) > new Date() ? sum + batch.credits_remaining : sum, 0) || 0;
    
    // Count by type
    const freeCreditsAdded = creditBatches?.filter(batch => batch.batch_type === 'monthly_free' || batch.batch_type === 'welcome')
      .reduce((sum, batch) => sum + batch.credits_added, 0) || 0;
    const purchasedCreditsAdded = creditBatches?.filter(batch => batch.batch_type === 'purchase')
      .reduce((sum, batch) => sum + batch.credits_added, 0) || 0;
    const bonusCreditsAdded = creditBatches?.filter(batch => batch.batch_type === 'bonus')
      .reduce((sum, batch) => sum + batch.credits_added, 0) || 0;

    // Count expired credits
    const expiredCredits = creditBatches?.filter(batch => 
      !batch.is_active || new Date(batch.expiry_date) <= new Date()
    ).reduce((sum, batch) => sum + batch.credits_remaining, 0) || 0;

    return NextResponse.json({
      summary: {
        total_credits_added: totalCreditsAdded,
        total_credits_used: totalCreditsUsed,
        total_credits_remaining: totalCreditsRemaining,
        free_credits_added: freeCreditsAdded,
        purchased_credits_added: purchasedCreditsAdded,
        bonus_credits_added: bonusCreditsAdded,
        expired_credits: expiredCredits
      },
      batches: creditBatches || [],
      usage_history: creditUsage || []
    });

  } catch (error) {
    console.error("Credit statement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
