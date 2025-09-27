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
    const { credits } = body;

    // Validate credits (must be multiple of 100)
    if (!credits || credits % 100 !== 0 || credits < 100) {
      return NextResponse.json(
        { error: "Credits must be a multiple of 100 and at least 100" },
        { status: 400 }
      );
    }

    // Calculate pricing with bonus
    const hundredsCount = credits / 100;
    const bonusCredits = Math.round((credits * 5) / 100); // 5% bonus
    const totalCredits = credits + bonusCredits;
    const priceInr = hundredsCount * 9900; // ₹99 per 100 credits in paise

    // Generate unique receipt ID
    const receiptId = `receipt_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount: priceInr,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        user_id: user.id,
        credits: credits.toString(),
        bonus_credits: bonusCredits.toString(),
        total_credits: totalCredits.toString(),
        plan_type: 'flexible'
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
        base: credits,
        bonus: bonusCredits,
        total: totalCredits
      },
      price: {
        inr: priceInr / 100, // Convert paise to rupees
        usd: (priceInr / 100) * 0.012 // Approximate USD conversion
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
