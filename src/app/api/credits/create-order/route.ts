import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { createRazorpayOrder } from "@/lib/razorpay";
import { calculateCreditPricing, type SupportedCurrency } from "@/lib/pricing-utils";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { credits } = body;

    // Validate credits (must be multiple of 100)
    if (!credits || credits % 100 !== 0 || credits < 100) {
      return NextResponse.json(
        { error: "Credits must be a multiple of 100 and at least 100" },
        { status: 400 }
      );
    }

    // Get user's preferred currency
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('preferred_currency')
      .eq('id', user.id)
      .single();

    const userCurrency = (userData?.preferred_currency || 'INR') as SupportedCurrency;

    // Calculate pricing using the new utility
    const pricing = calculateCreditPricing(credits, userCurrency);

    // Generate unique receipt ID (max 40 chars for Razorpay)
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const randomId = Math.random().toString(36).substr(2, 6); // 6 chars
    const receiptId = `rcpt_${timestamp}_${randomId}`; // Total: 7 + 8 + 1 + 6 = 22 chars

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount: pricing.finalAmount,
      currency: pricing.finalCurrency,
      receipt: receiptId,
      notes: {
        user_id: user.id,
        credits: pricing.baseCredits.toString(),
        bonus_credits: pricing.bonusCredits.toString(),
        total_credits: pricing.totalCredits.toString(),
        plan_type: 'flexible',
        original_currency: 'INR',
        original_amount: pricing.basePriceInr.toString(),
        markup: pricing.markup.toString()
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
      credits: {
        base: pricing.baseCredits,
        bonus: pricing.bonusCredits,
        total: pricing.totalCredits
      },
      pricing: {
        amount: pricing.finalAmount,
        currency: pricing.finalCurrency,
        original_amount: pricing.basePriceInr,
        original_currency: 'INR',
        user_currency: userCurrency,
        markup: pricing.markup,
        original_price: pricing.originalPrice
      }
    });

  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
