import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function GET(request: NextRequest) {
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

    // Get user's current subscription from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error("Database error:", userError);
      return NextResponse.json(
        { error: "Failed to fetch subscription" },
        { status: 500 }
      );
    }

    // Get active premium subscription if exists
    const { data: premiumSubscription, error: premiumError } = await supabase
      .from('user_premium_credits')
      .select(`
        id,
        credits_remaining,
        expires_at,
        total_credits,
        purchase_id,
        credit_purchases!inner(
          id,
          plan_id,
          status,
          purchase_date,
          insighter_plans!inner(
            plan_type,
            monthly_credits,
            price_inr
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .single();

    if (premiumError && premiumError.code !== 'PGRST116') {
      console.error("Premium subscription error:", premiumError);
    }

    // Format subscription data
    let subscription = null;
    
    if (premiumSubscription) {
      const purchase = premiumSubscription.credit_purchases[0];
      const plan = purchase.insighter_plans[0];
      subscription = {
        id: premiumSubscription.id,
        plan_type: plan.plan_type,
        status: purchase.status,
        current_period_start: purchase.purchase_date,
        current_period_end: premiumSubscription.expires_at,
        monthly_credits: plan.monthly_credits,
        price_inr: plan.price_inr,
        is_annual: false // You might want to add this field to your schema
      };
    } else if (userData?.subscription_tier === 'free') {
      subscription = {
        id: 'free',
        plan_type: 'free',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        monthly_credits: 100,
        price_inr: 0,
        is_annual: false
      };
    }

    return NextResponse.json({
      subscription
    });

  } catch (error) {
    console.error("Subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
