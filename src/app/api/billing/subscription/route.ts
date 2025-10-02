import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function GET(_request: NextRequest) {
  try {
    console.log("🔍 [SUBSCRIPTION] API called");
    
    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log("🔐 [SUBSCRIPTION] No authenticated user found");
      return NextResponse.json(
        { error: "Authentication required" },
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

    // Get active premium purchases
    const { data: activePurchases, error: purchaseError } = await supabase
      .from('insighter_purchases')
      .select(`
        id,
        plan_id,
        payment_id,
        order_id,
        amount_paid,
        credits_purchased,
        batch_code,
        status,
        currency,
        purchase_date,
        created_at,
        is_annual,
        billing_period
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('purchase_date', { ascending: false });

    if (purchaseError) {
      console.error("Purchase error:", purchaseError);
    }

    // Check for active credit batches
    const { data: activeBatches, error: batchError } = await supabase
      .from('insighter_credit_batches')
      .select(`
        id,
        batch_code,
        credits_added,
        credits_remaining,
        batch_type,
        plan_type,
        added_date,
        expiry_date,
        is_active,
        is_annual
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gt('expiry_date', new Date().toISOString().split('T')[0])
      .order('expiry_date', { ascending: false });

    if (batchError) {
      console.error("Batch error:", batchError);
    }

    // Format subscription data
    let subscription = null;
    
    if (activePurchases && activePurchases.length > 0) {
      const latestPurchase = activePurchases[0];
      
      // Get plan details
      const { data: planData, error: planError } = await supabase
        .from('insighter_plans')
        .select('*')
        .eq('id', latestPurchase.plan_id)
        .single();

      if (!planError && planData) {
        // Find the corresponding active batch
        const correspondingBatch = activeBatches?.find(batch => 
          batch.batch_code === latestPurchase.batch_code
        );

        if (correspondingBatch) {
          // Determine if this is an annual subscription
          const isAnnual = latestPurchase.is_annual || 
                          latestPurchase.billing_period === 'annual' ||
                          correspondingBatch.is_annual ||
                          // Fallback: check if amount paid suggests annual (10x+ monthly price)
                          (latestPurchase.amount_paid >= (planData.price_inr * 10));
          
          subscription = {
            id: latestPurchase.id,
            plan_type: planData.plan_type,
            status: latestPurchase.status,
            current_period_start: latestPurchase.purchase_date,
            current_period_end: correspondingBatch.expiry_date,
            monthly_credits: planData.monthly_credits,
            price_inr: planData.price_inr,
            is_annual: isAnnual,
            billing_period: latestPurchase.billing_period || (isAnnual ? 'annual' : 'monthly')
          };
        }
      }
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
