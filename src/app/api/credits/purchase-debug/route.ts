import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { verifyPaymentSignature } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [DEBUG] Payment verification started");
    
    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log("❌ [DEBUG] Auth error:", authError);
      return NextResponse.json(
        { error: "Unauthorized", debug: { authError } },
        { status: 401 }
      );
    }

    console.log("✅ [DEBUG] User authenticated:", user.id);

    const body = await request.json();
    console.log("📝 [DEBUG] Request body:", JSON.stringify(body, null, 2));
    
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
    console.log("🔐 [DEBUG] Verifying payment signature...");
    const isValidSignature = await verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    console.log("🔐 [DEBUG] Signature valid:", isValidSignature);

    if (!isValidSignature) {
      console.log("❌ [DEBUG] Invalid payment signature");
      return NextResponse.json(
        { error: "Invalid payment signature", debug: { isValidSignature } },
        { status: 400 }
      );
    }

    console.log("✅ [DEBUG] Payment signature verified");

    // Test if the database function exists
    console.log("🗄️ [DEBUG] Testing database function...");
    try {
      const { data: testData, error: testError } = await supabase.rpc('purchase_flexible_credits', {
        p_user_id: user.id,
        p_credits_to_buy: credits,
        p_payment_id: razorpay_payment_id,
        p_order_id: razorpay_order_id,
        p_amount_paid: amount_paid,
        p_currency: currency
      });

      console.log("🗄️ [DEBUG] Database function result:", { testData, testError });

      if (testError) {
        console.error("❌ [DEBUG] Database error:", testError);
        return NextResponse.json(
          { 
            error: "Failed to purchase credits", 
            debug: { 
              databaseError: testError,
              functionExists: !testError.message.includes('does not exist')
            } 
          },
          { status: 500 }
        );
      }

      console.log("✅ [DEBUG] Credits purchased successfully, batch ID:", testData);

      return NextResponse.json({
        success: true,
        message: "Credits purchased successfully",
        data: {
          batchId: testData,
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
        },
        debug: {
          userId: user.id,
          signatureValid: isValidSignature,
          batchId: testData
        }
      });

    } catch (dbError) {
      console.error("❌ [DEBUG] Database function error:", dbError);
      const error = dbError instanceof Error ? dbError : new Error(String(dbError));
      return NextResponse.json(
        { 
          error: "Database function error", 
          debug: { 
            error: error.message,
            stack: error.stack
          } 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("❌ [DEBUG] Unexpected error:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { 
        error: "Internal server error", 
        debug: { 
          error: err.message,
          stack: err.stack
        } 
      },
      { status: 500 }
    );
  }
}
