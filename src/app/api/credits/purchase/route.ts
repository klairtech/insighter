import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { verifyPaymentSignature } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [PURCHASE] Starting credit purchase process");
    
    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log("❌ [PURCHASE] Auth error:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("✅ [PURCHASE] User authenticated:", user.id);

    const body = await request.json();
    console.log("📝 [PURCHASE] Request body:", JSON.stringify(body, null, 2));
    
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
    console.log("🔐 [PURCHASE] Verifying payment signature...");
    const isValidSignature = await verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    console.log("🔐 [PURCHASE] Signature valid:", isValidSignature);

    if (!isValidSignature) {
      console.log("❌ [PURCHASE] Invalid payment signature");
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    console.log("✅ [PURCHASE] Payment signature verified");

    // Call the database function to purchase credits
    console.log("🗄️ [PURCHASE] Calling buy_flexible_credits function...");
    const { data, error } = await supabase.rpc('buy_flexible_credits', {
      p_user_id: user.id,
      p_credits_to_buy: credits,
      p_order_id: razorpay_order_id,
      p_payment_id: razorpay_payment_id,
      p_amount_paid: amount_paid,
      p_currency: currency
    });

    console.log("🗄️ [PURCHASE] Database function result:", { data, error });

    if (error) {
      console.error("❌ [PURCHASE] Database error:", error);
      return NextResponse.json(
        { 
          error: "Failed to purchase credits",
          details: error.message,
          code: "DATABASE_ERROR",
          debug: {
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
            errorHint: error.hint
          }
        },
        { status: 500 }
      );
    }

    console.log("✅ [PURCHASE] Credits purchased successfully, batch ID:", data);

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
        amount: amount_paid,
        currency: currency
      }
    });

  } catch (error) {
    console.error("Credit purchase error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        code: "INTERNAL_ERROR"
      },
      { status: 500 }
    );
  }
}
