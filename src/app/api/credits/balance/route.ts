import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-auth";

export async function GET() {
  try {
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Call the database function to get user's credit balance
    const { data, error } = await supabase.rpc('get_user_credit_balance', {
      p_user_id: user.id
    });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch credit balance" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      balance: data || 0
    });

  } catch (error) {
    console.error("Credit balance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
