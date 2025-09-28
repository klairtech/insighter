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

    // Fetch purchase history from insighter_purchases table only
    const { data: purchases, error: purchaseError } = await supabase
      .from('insighter_purchases')
      .select(`
        id,
        credits_purchased,
        amount_paid,
        status,
        purchase_date,
        payment_id,
        order_id,
        insighter_plans!inner(
          plan_type
        )
      `)
      .eq('user_id', user.id)
      .order('purchase_date', { ascending: false });

    if (purchaseError) {
      console.error("Database error:", purchaseError);
      return NextResponse.json(
        { error: "Failed to fetch purchase history" },
        { status: 500 }
      );
    }

    // Format purchases
    const allPurchases = (purchases || []).map(p => ({
      id: p.id,
      credits_purchased: p.credits_purchased,
      bonus_credits: 0,
      total_credits: p.credits_purchased,
      amount_paid: p.amount_paid,
      status: p.status,
      purchase_date: p.purchase_date,
      plan_type: p.insighter_plans?.[0]?.plan_type || 'flexible',
      razorpay_payment_id: p.payment_id,
      razorpay_order_id: p.order_id
    }));

    return NextResponse.json({
      purchases: allPurchases
    });

  } catch (error) {
    console.error("Purchase history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
