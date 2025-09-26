import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/database'

// Helper function to verify admin Supabase session
async function verifyAdminSession(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return null
    }
    
    // Check if user has admin role in organization_members
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()
    
    if (membershipError || !membership) {
      return null
    }
    
    return { userId: user.id, email: user.email, role: 'admin' }
  } catch (error) {
    console.error('Supabase auth error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyAdminSession(request)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get dashboard statistics using Supabase
    const [usersResult, organizationsResult, workspacesResult, connectionsResult] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('workspaces').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('database_connections').select('id', { count: 'exact', head: true }).eq('is_active', true)
    ])

    // Get recent users and organizations
    const [recentUsersResult, recentOrganizationsResult] = await Promise.all([
      supabaseAdmin.from('users').select('id, name, email, created_at').order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('organizations').select('id, name, industry, created_at').order('created_at', { ascending: false }).limit(5)
    ])

    const dashboardData = {
      totalUsers: usersResult.count || 0,
      totalOrganizations: organizationsResult.count || 0,
      totalWorkspaces: workspacesResult.count || 0,
      totalConnections: connectionsResult.count || 0,
      recentUsers: recentUsersResult.data || [],
      recentOrganizations: recentOrganizationsResult.data || []
    }

    return NextResponse.json(dashboardData)

  } catch (err) {
    console.error('Get admin dashboard error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
