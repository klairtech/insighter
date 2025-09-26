import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Helper function to verify Supabase JWT token
export async function verifySupabaseToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return null
    }
    return user
  } catch (err) {
    console.error('Supabase token verification error:', err);
    return null
  }
}

// Helper function to get user from Supabase users table
export async function getUserProfile(userId: string) {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error);
      return null
    }

    return userProfile
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null
  }
}

// Helper function to update user profile
export async function updateUserProfile(userId: string, updates: Record<string, unknown>) {
  try {
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user profile:', error);
      return null
    }

    return updatedUser
  } catch (error) {
    console.error('Error updating user profile:', error);
    return null
  }
}

// Export supabase client for direct use
export { supabase }
