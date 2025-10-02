import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-auth";

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    console.log(`🎉 Allocating welcome credits for new user: ${userId}`);

    // Check if user already has welcome credits
    const { data: existingBatch, error: checkError } = await supabaseServer
      .from('insighter_credit_batches')
      .select('id')
      .eq('user_id', userId)
      .eq('batch_type', 'bonus')
      .like('batch_code', 'welcome_%')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`❌ Error checking existing welcome credits for user ${userId}:`, checkError);
      return NextResponse.json(
        { error: "Failed to check existing credits" },
        { status: 500 }
      );
    }

    if (existingBatch) {
      console.log(`ℹ️ User ${userId} already has welcome credits`);
      return NextResponse.json({
        message: "User already has welcome credits",
        credits: 0
      });
    }

    // Create welcome credit batch
    const batchCode = `welcome_${userId}_${Date.now()}`;
    const currentDate = new Date();
    
    // Calculate prorated welcome credits based on remaining days in month
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const daysInMonth = currentMonthEnd.getDate();
    const daysRemaining = Math.max(1, daysInMonth - currentDate.getDate() + 1);
    const welcomeCredits = Math.round((100 * daysRemaining) / daysInMonth); // Prorated from 100 monthly credits
    
    const expiryDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 10); // 10th of next month

    const { data: batch, error: batchError } = await supabaseServer
      .from('insighter_credit_batches')
      .insert({
        user_id: userId,
        batch_code: batchCode,
        credits_added: welcomeCredits,
        credits_remaining: welcomeCredits,
        credits_used: 0,
        batch_type: 'bonus',
        plan_type: 'free',
        added_date: currentDate.toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0],
        is_active: true
      })
      .select()
      .single();

    if (batchError) {
      console.error(`❌ Error creating welcome credit batch for user ${userId}:`, batchError);
      return NextResponse.json(
        { error: "Failed to allocate welcome credits" },
        { status: 500 }
      );
    }

    console.log(`✅ Allocated ${welcomeCredits} prorated welcome credits to user ${userId} (${daysRemaining} days remaining in month)`);

    return NextResponse.json({
      message: "Welcome credits allocated successfully",
      credits: welcomeCredits,
      batchId: batch.id
    });

  } catch (error) {
    console.error('❌ Welcome credit allocation error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
