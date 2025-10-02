import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      rewardType = 'loyalty', 
      creditsPerUser = 100, 
      description = 'Loyalty Reward',
      targetUsers = 'all' // 'all', 'free', 'premium', or array of user IDs
    } = body;

    console.log(`🎁 Starting ${rewardType} reward allocation...`);

    let users;
    
    if (Array.isArray(targetUsers)) {
      // Specific user IDs provided
      const { data: specificUsers, error: specificError } = await supabaseServer
        .from('users')
        .select('id, email, subscription_tier')
        .in('id', targetUsers);

      if (specificError) {
        console.error('❌ Error fetching specific users:', specificError);
        return NextResponse.json(
          { error: "Failed to fetch users" },
          { status: 500 }
        );
      }
      users = specificUsers;
    } else {
      // Fetch users based on criteria
      let query = supabaseServer
        .from('users')
        .select('id, email, subscription_tier');

      if (targetUsers === 'free') {
        query = query.eq('subscription_tier', 'free');
      } else if (targetUsers === 'premium') {
        query = query.in('subscription_tier', ['pro', 'enterprise']);
      }
      // 'all' means no filter

      const { data: allUsers, error: usersError } = await query;

      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        return NextResponse.json(
          { error: "Failed to fetch users" },
          { status: 500 }
        );
      }
      users = allUsers;
    }

    if (!users || users.length === 0) {
      console.log('ℹ️ No users found for reward allocation');
      return NextResponse.json({
        message: "No users found for reward allocation",
        rewarded: 0
      });
    }

    let rewardedCount = 0;
    const currentDate = new Date();
    const expiryDate = new Date(currentDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

    // Allocate credits for each user
    for (const user of users) {
      try {
        // Check if user already has this type of reward recently (within last 30 days)
        const { data: existingBatch, error: checkError } = await supabaseServer
          .from('insighter_credit_batches')
          .select('id')
          .eq('user_id', user.id)
          .eq('batch_type', 'bonus')
          .like('batch_code', `${rewardType}_%`)
          .gte('added_date', new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`❌ Error checking existing reward for user ${user.id}:`, checkError);
          continue;
        }

        if (existingBatch) {
          console.log(`ℹ️ User ${user.id} already received ${rewardType} reward recently`);
          continue;
        }

        // Create reward credit batch
        const batchCode = `${rewardType}_${user.id}_${Date.now()}`;
        
        const { error: batchError } = await supabaseServer
          .from('insighter_credit_batches')
          .insert({
            user_id: user.id,
            batch_code: batchCode,
            credits_added: creditsPerUser,
            credits_remaining: creditsPerUser,
            credits_used: 0,
            batch_type: 'bonus',
            plan_type: user.subscription_tier || 'free',
            added_date: currentDate.toISOString().split('T')[0],
            expiry_date: expiryDate.toISOString().split('T')[0],
            is_active: true
          })
          .select()
          .single();

        if (batchError) {
          console.error(`❌ Error creating reward batch for user ${user.id}:`, batchError);
          continue;
        }

        console.log(`✅ Allocated ${creditsPerUser} ${rewardType} credits to user ${user.id}`);
        rewardedCount++;

      } catch (error) {
        console.error(`❌ Error processing user ${user.id}:`, error);
        continue;
      }
    }

    console.log(`✅ ${rewardType} reward allocation completed. Rewarded ${rewardedCount} users.`);

    return NextResponse.json({
      message: `${rewardType} reward allocation completed`,
      rewarded: rewardedCount,
      totalUsers: users.length,
      creditsPerUser,
      description
    });

  } catch (error) {
    console.error('❌ Reward allocation error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
