import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { verifyPaymentSignature } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [DETAILED DEBUG] Payment verification started");
    
    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log("❌ [DETAILED DEBUG] Auth error:", authError);
      return NextResponse.json(
        { error: "Unauthorized", debug: { authError } },
        { status: 401 }
      );
    }

    console.log("✅ [DETAILED DEBUG] User authenticated:", user.id);

    const body = await request.json();
    console.log("📝 [DETAILED DEBUG] Request body:", JSON.stringify(body, null, 2));
    
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature
    } = body;

    // Verify payment signature
    console.log("🔐 [DETAILED DEBUG] Verifying payment signature...");
    const isValidSignature = await verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    console.log("🔐 [DETAILED DEBUG] Signature valid:", isValidSignature);

    if (!isValidSignature) {
      console.log("❌ [DETAILED DEBUG] Invalid payment signature");
      return NextResponse.json(
        { error: "Invalid payment signature", debug: { isValidSignature } },
        { status: 400 }
      );
    }

    console.log("✅ [DETAILED DEBUG] Payment signature verified");

    // Test database connection first
    console.log("🗄️ [DETAILED DEBUG] Testing database connection...");
    try {
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();
      
      console.log("🗄️ [DETAILED DEBUG] Database connection test:", { testData, testError });
    } catch (dbTestError) {
      console.error("❌ [DETAILED DEBUG] Database connection failed:", dbTestError);
      return NextResponse.json(
        { error: "Database connection failed", debug: { dbTestError } },
        { status: 500 }
      );
    }

    // Test if the function exists
    console.log("🔍 [DETAILED DEBUG] Checking if function exists...");
    try {
      const { data: functionCheck, error: functionError } = await supabase
        .rpc('buy_flexible_credits', {
          p_user_id: user.id,
          p_credits_to_buy: 100, // Test with minimal credits
          p_order_id: 'test_order_' + Date.now(),
          p_payment_id: 'test_payment_' + Date.now(),
          p_amount_paid: 9900, // ₹99 in paise
          p_currency: 'INR'
        });

      console.log("🔍 [DETAILED DEBUG] Function test result:", { functionCheck, functionError });

      if (functionError) {
        console.error("❌ [DETAILED DEBUG] Function error:", functionError);
        return NextResponse.json(
          { 
            error: "Database function error", 
            debug: { 
              functionError,
              functionExists: !functionError.message.includes('does not exist'),
              errorCode: functionError.code,
              errorMessage: functionError.message,
              errorDetails: functionError.details,
              errorHint: functionError.hint
            } 
          },
          { status: 500 }
        );
      }

      console.log("✅ [DETAILED DEBUG] Function test successful, batch ID:", functionCheck);

      return NextResponse.json({
        success: true,
        message: "Function test successful",
        debug: {
          userId: user.id,
          signatureValid: isValidSignature,
          batchId: functionCheck,
          testCredits: 100,
          testAmount: 9900
        }
      });

    } catch (functionTestError) {
      console.error("❌ [DETAILED DEBUG] Function test error:", functionTestError);
      const error = functionTestError instanceof Error ? functionTestError : new Error(String(functionTestError));
      return NextResponse.json(
        { 
          error: "Function test failed", 
          debug: { 
            error: error.message,
            stack: error.stack,
            name: error.name
          } 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("❌ [DETAILED DEBUG] Unexpected error:", error);
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { 
        error: "Internal server error", 
        debug: { 
          error: err.message,
          stack: err.stack,
          name: err.name
        } 
      },
      { status: 500 }
    );
  }
}
