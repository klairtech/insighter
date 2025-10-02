import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function POST(request: NextRequest) {
  try {
    // Create server-side Supabase client
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin (you can modify this check as needed)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Simple admin check - you can make this more sophisticated
    const adminEmails = ['kavetysandeep@gmail.com']; // Add more admin emails as needed
    if (!adminEmails.includes(userData.email)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetEmail, credits = 10000, reason = "Admin credit addition" } = body;

    if (!targetEmail) {
      return NextResponse.json(
        { error: "Target email is required" },
        { status: 400 }
      );
    }

    if (credits <= 0 || credits > 100000) {
      return NextResponse.json(
        { error: "Credits must be between 1 and 100,000" },
        { status: 400 }
      );
    }

    // Get the target user ID - search by email in users table
    const { data: targetUserData, error: targetUserError } = await supabase
      .from('users')
      .select('id')
      .eq('email', targetEmail)
      .single();
    
    const targetUser = targetUserData ? { user: { id: targetUserData.id } } : null;
    
    if (targetUserError || !targetUser || !targetUser.user) {
      return NextResponse.json(
        { error: `User with email ${targetEmail} not found` },
        { status: 404 }
      );
    }

    const targetUserId = targetUser.user.id;

    // Generate unique batch code
    const timestamp = Date.now().toString().slice(-8);
    const randomId = Math.random().toString(36).substr(2, 6);
    const batchCode = `admin_${timestamp}_${randomId}`;

    // Calculate expiry date (1 year from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    // Insert credit batch
    const { data: creditBatch, error: creditError } = await supabase
      .from('insighter_credit_batches')
      .insert({
        user_id: targetUserId,
        batch_code: batchCode,
        credits_added: credits,
        credits_remaining: credits,
        credits_used: 0,
        batch_type: 'bonus',
        plan_type: 'flexible',
        added_date: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0],
        is_active: true
      })
      .select()
      .single();

    if (creditError) {
      console.error("Error adding credits:", creditError);
      return NextResponse.json(
        { error: "Failed to add credits" },
        { status: 500 }
      );
    }

    // Get current total credits for verification
    const { data: creditBatches } = await supabase
      .from('insighter_credit_batches')
      .select('credits_remaining')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .gt('credits_remaining', 0);

    const totalCredits = creditBatches?.reduce((sum, batch) => sum + batch.credits_remaining, 0) || 0;

    return NextResponse.json({
      success: true,
      message: `Successfully added ${credits} credits to ${targetEmail}`,
      data: {
        targetEmail,
        creditsAdded: credits,
        totalCredits,
        batchId: creditBatch.id,
        batchCode,
        expiryDate: creditBatch.expiry_date,
        addedBy: userData.email,
        reason
      }
    });

  } catch (error) {
    console.error("Admin add credits error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
