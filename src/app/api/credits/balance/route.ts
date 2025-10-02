import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { getUserCreditBalance } from "@/lib/credit-service-server";

export async function GET() {
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

    // Use centralized credit service
    const creditBalance = await getUserCreditBalance(user.id);

    return NextResponse.json(creditBalance);

  } catch (error) {
    console.error("Credit balance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
