import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function POST(request: NextRequest) {
  try {
    console.log("🚪 Server-side signout started");
    
    // Create server-side Supabase client
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log("🚪 No user to sign out:", authError.message);
    } else if (user) {
      console.log("🚪 Signing out user:", user.id);
    }

    // Sign out from Supabase (this will clear HTTP-only cookies)
    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    
    if (signOutError) {
      console.error("🚪 Server signout error:", signOutError);
    } else {
      console.log("🚪 Server signout successful");
    }

    // Create response and clear cookies manually
    const response = NextResponse.json({ success: true });
    
    // Clear all possible Supabase cookies
    const cookiesToClear = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'supabase.auth.token'
    ];

    cookiesToClear.forEach(cookieName => {
      // Clear for current domain
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      
      // Clear for parent domain
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        domain: `.${request.nextUrl.hostname}`,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    });

    return response;

  } catch (error) {
    console.error("🚪 Server signout error:", error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
