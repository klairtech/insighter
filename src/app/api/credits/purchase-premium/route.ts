import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { verifyPaymentSignature } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [PREMIUM PURCHASE] Starting premium purchase verification");
    
    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log("❌ [PREMIUM PURCHASE] Auth error:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("✅ [PREMIUM PURCHASE] User authenticated:", user.id);

    const body = await request.json();
    console.log("📝 [PREMIUM PURCHASE] Request body:", JSON.stringify(body, null, 2));
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
    console.log("🔐 [PREMIUM PURCHASE] Verifying payment signature...");
    const isValidSignature = await verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    console.log("🔐 [PREMIUM PURCHASE] Signature valid:", isValidSignature);

    if (!isValidSignature) {
      console.log("❌ [PREMIUM PURCHASE] Invalid payment signature");
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    console.log("✅ [PREMIUM PURCHASE] Payment signature verified");

    // Get plan details - planType comes as lowercase from frontend
    console.log("🔍 [PREMIUM PURCHASE] Looking for plan with type:", planType);
    const { data: planData, error: planError } = await supabase
      .from('insighter_plans')
      .select('*')
      .eq('plan_type', planType)
      .eq('is_active', true)
      .single();

    if (planError || !planData) {
      console.log("❌ [PREMIUM PURCHASE] Plan not found:", planError);
      return NextResponse.json(
        { error: "Plan not found", debug: { planError, planType } },
        { status: 400 }
      );
    }

    console.log("✅ [PREMIUM PURCHASE] Plan found:", planData.plan_name);

    // Call the database function to purchase premium credits
    console.log("🗄️ [PREMIUM PURCHASE] Calling buy_premium_credits function...");
    console.log("🗄️ [PREMIUM PURCHASE] Function parameters:", {
      p_user_id: user.id,
      p_plan_id: planData.id,
      p_payment_id: razorpay_payment_id,
      p_order_id: razorpay_order_id,
      p_amount_paid: amount_paid
    });
    
    const { data, error } = await supabase.rpc('buy_premium_credits', {
      p_user_id: user.id,
      p_plan_id: planData.id,
      p_payment_id: razorpay_payment_id,
      p_order_id: razorpay_order_id,
      p_amount_paid: amount_paid,
      p_is_annual: isAnnual || false
    });

    console.log("🗄️ [PREMIUM PURCHASE] Function response:", { data, error });

    if (error) {
      console.error("❌ [PREMIUM PURCHASE] Database error:", error);
      return NextResponse.json(
        { error: "Failed to purchase premium plan", debug: { error, functionName: 'buy_premium_credits' } },
        { status: 500 }
      );
    }

    console.log("✅ [PREMIUM PURCHASE] Purchase successful, ID:", data);

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
    console.error("❌ [PREMIUM PURCHASE] Unexpected error:", error);
    
    // Ensure we always return a proper JSON response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = {
      error: "Internal server error",
      debug: {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    };
    
    console.error("❌ [PREMIUM PURCHASE] Error details:", errorDetails);
    
    return NextResponse.json(errorDetails, { status: 500 });
  }
}
