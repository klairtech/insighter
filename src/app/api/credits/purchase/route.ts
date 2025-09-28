import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { verifyPaymentSignature } from "@/lib/razorpay";

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
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      credits,
      bonus_credits,
      total_credits,
      amount_paid,
      currency = 'INR'
    } = body;

    // Verify payment signature
    const isValidSignature = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    // Call the database function to purchase credits
    const { data, error } = await supabase.rpc('purchase_flexible_credits', {
      p_user_id: user.id,
      p_credits_to_buy: credits,
      p_payment_id: razorpay_payment_id,
      p_order_id: razorpay_order_id,
      p_amount_paid: amount_paid,
      p_currency: currency
    });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to purchase credits" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      purchaseId: data,
      credits: {
        base: credits,
        bonus: bonus_credits,
        total: total_credits
      },
      payment: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        amount: amount_paid
      }
    });

  } catch (error) {
    console.error("Credit purchase error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
