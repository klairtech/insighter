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

    // Get detailed credit balance information
    const { data: creditBatches, error: batchError } = await supabase
      .from('insighter_credit_batches')
      .select('credits_added, credits_used, credits_remaining, batch_type, added_date, expiry_date')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gt('credits_remaining', 0);

    if (batchError) {
      console.error("Database error:", batchError);
      return NextResponse.json(
        { error: "Failed to fetch credit balance" },
        { status: 500 }
      );
    }

    // Calculate totals
    const totalCredits = creditBatches?.reduce((sum, batch) => sum + batch.credits_added, 0) || 0;
    const totalUsed = creditBatches?.reduce((sum, batch) => sum + batch.credits_used, 0) || 0;
    const currentBalance = creditBatches?.reduce((sum, batch) => sum + batch.credits_remaining, 0) || 0;

    return NextResponse.json({
      balance: currentBalance,
      total_purchased: totalCredits,
      total_used: totalUsed,
      batches: creditBatches || []
    });

  } catch (error) {
    console.error("Credit balance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
