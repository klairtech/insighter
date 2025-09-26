import { NextRequest, NextResponse } from 'next/server'
import { verifySupabaseToken, getUserProfile, updateUserProfile } from '@/lib/supabase-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await verifySupabaseToken(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile from Supabase users table
    const userProfile = await getUserProfile(user.id)

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(userProfile)

  } catch (_err) {
    console.error('Get user profile error:', _err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifySupabaseToken(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, avatar_path } = await request.json()

    // Update user profile in Supabase
    const updatedUser = await updateUserProfile(user.id, {
      name,
      avatar_path
    })

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ...updatedUser,
      message: 'Profile updated successfully'
    })

  } catch (_error) {
    console.error('Update user profile error:', _error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
