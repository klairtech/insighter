import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-auth";
import { verifyPaymentSignature } from "@/lib/razorpay";

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
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      planType,
      isAnnual,
      credits,
      amount_paid
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

    // Get plan details
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

    // Call the database function to purchase premium credits
    const { data, error } = await supabase.rpc('purchase_credits', {
      p_user_id: user.id,
      p_plan_id: planData.id,
      p_payment_id: razorpay_payment_id,
      p_order_id: razorpay_order_id
    });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to purchase premium plan" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      purchaseId: data,
      plan: {
        type: planType,
        isAnnual: isAnnual,
        credits: credits
      },
      payment: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        amount: amount_paid
      }
    });

  } catch (error) {
    console.error("Premium purchase error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
