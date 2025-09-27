import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-auth";
import { createRazorpayOrder } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { planType, isAnnual } = body;

    // Get plan details from database
    const { data: planData, error: planError } = await supabase
      .from('insighter_plans')
      .select('*')
      .eq('plan_type', planType)
      .eq('is_active', true)
      .single();

    if (planError || !planData) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 400 }
      );
    }

    // Calculate pricing with 10% discount for annual
    const monthlyPrice = planData.price_inr;
    const annualPrice = isAnnual ? Math.round(monthlyPrice * 12 * 0.9) : monthlyPrice; // 10% discount for annual
    const priceInr = isAnnual ? annualPrice : monthlyPrice;
    const credits = planData.monthly_credits;

    // Generate unique receipt ID
    const receiptId = `receipt_${user.id}_${planType}_${isAnnual ? 'annual' : 'monthly'}_${Date.now()}`;

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount: priceInr,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        user_id: user.id,
        plan_type: planType,
        is_annual: isAnnual.toString(),
        credits: credits.toString(),
        billing_period: isAnnual ? 'annual' : 'monthly'
      }
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      credits: credits,
      plan: {
        type: planType,
        isAnnual: isAnnual,
        price: {
          inr: priceInr / 100, // Convert paise to rupees
          usd: (priceInr / 100) * 0.012 // Approximate USD conversion
        }
      }
    });

  } catch (error) {
    console.error("Create premium order error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
