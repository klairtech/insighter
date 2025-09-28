import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Password change request received');
    
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    console.log('✅ User authenticated:', user.id);

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    console.log('📝 Password change data received');

    if (!currentPassword || !newPassword) {
      console.log('❌ Missing password fields');
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      console.log('❌ Password too short');
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // First, verify the current password by attempting to sign in
    console.log('🔍 Verifying current password...');
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    });

    if (verifyError) {
      console.error('❌ Password verification error:', verifyError);
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    console.log('✅ Current password verified');

    // Update password using Supabase Auth
    console.log('🔄 Updating password...');
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('❌ Password update error:', updateError);
      
      // Handle specific error cases
      if (updateError.message.includes('Password should be at least')) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long" },
          { status: 400 }
        );
      }
      
      if (updateError.message.includes('same as the old password')) {
        return NextResponse.json(
          { error: "New password must be different from current password" },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    console.log('✅ Password updated successfully');
    return NextResponse.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("❌ Password change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
