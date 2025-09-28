import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-auth";

export async function POST(request: NextRequest) {
  try {
    // This endpoint should be called by a cron job or scheduled task
    // For security, you might want to add an API key check here
    
    console.log('🔄 Starting monthly credit allocation...');

    // Get all users with free tier
    const { data: users, error: usersError } = await supabaseServer
      .from('users')
      .select('id, email, subscription_tier, created_at')
      .eq('subscription_tier', 'free');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      console.log('ℹ️ No free tier users found');
      return NextResponse.json({
        message: "No free tier users found",
        allocated: 0
      });
    }

    let allocatedCount = 0;
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 10); // 10th of next month

    // Allocate credits for each user
    for (const user of users) {
      try {
        // Check if user already has credits for this month
        const { data: existingBatch, error: checkError } = await supabaseServer
          .from('insighter_credit_batches')
          .select('id')
          .eq('user_id', user.id)
          .eq('batch_type', 'monthly_free')
          .gte('added_date', new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString())
          .lt('added_date', nextMonth.toISOString())
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`❌ Error checking existing batch for user ${user.id}:`, checkError);
          continue;
        }

        if (existingBatch) {
          console.log(`ℹ️ User ${user.id} already has monthly credits for this month`);
          continue;
        }

        // Calculate prorated credits based on days remaining until next 10th
        const userCreatedDate = new Date(user.created_at);
        const nextTenth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 10);
        
        // If we're past the 10th this month, get next month's 10th
        if (currentDate.getDate() > 10) {
          nextTenth.setMonth(nextTenth.getMonth() + 1);
        }
        
        // Calculate days remaining until next 10th
        const daysRemaining = Math.max(1, Math.ceil((nextTenth.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
        const creditsToAllocate = Math.round((100 * daysRemaining) / 30); // 30 days = 100 credits
        
        console.log(`📅 User ${user.id} joined on ${userCreatedDate.toDateString()}, allocating ${creditsToAllocate} prorated credits for ${daysRemaining} days until ${nextTenth.toDateString()}`);

        // Create monthly free credit batch
        const batchCode = `monthly_free_${currentDate.getFullYear()}_${String(currentDate.getMonth() + 1).padStart(2, '0')}_${user.id}`;
        
        const { data: batch, error: batchError } = await supabaseServer
          .from('insighter_credit_batches')
          .insert({
            user_id: user.id,
            batch_code: batchCode,
            credits_added: creditsToAllocate,
            credits_remaining: creditsToAllocate,
            credits_used: 0,
            batch_type: 'monthly_free',
            plan_type: 'free',
            added_date: currentDate.toISOString().split('T')[0],
            expiry_date: nextTenth.toISOString().split('T')[0], // Next 10th
            is_active: true
          })
          .select()
          .single();

        if (batchError) {
          console.error(`❌ Error creating credit batch for user ${user.id}:`, batchError);
          continue;
        }

        console.log(`✅ Allocated 100 free credits to user ${user.id}`);
        allocatedCount++;

      } catch (error) {
        console.error(`❌ Error processing user ${user.id}:`, error);
        continue;
      }
    }

    console.log(`✅ Monthly credit allocation completed. Allocated to ${allocatedCount} users.`);

    return NextResponse.json({
      message: "Monthly credit allocation completed",
      allocated: allocatedCount,
      totalUsers: users.length
    });

  } catch (error) {
    console.error('❌ Monthly credit allocation error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
