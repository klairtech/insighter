import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

// Helper function to verify user session
async function verifyUserSession(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token)
    if (error || !user) {
      return null
    }
    return user
  } catch (err) {
    console.error('User organizations API token verification error:', err)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // const authHeader = request.headers.get('authorization')
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // First, get organization IDs where user is a member
    const { data: memberData, error: memberError } = await supabaseServer
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (memberError) {
      console.error('❌ User Organizations API: Error fetching organization memberships:', {
        error: memberError,
        message: memberError.message,
        details: memberError.details,
        hint: memberError.hint,
        code: memberError.code
      })
      return NextResponse.json(
        { error: 'Failed to fetch organization memberships' },
        { status: 500 }
      )
    }

    if (!memberData || memberData.length === 0) {
      return NextResponse.json([])
    }

    // Extract organization IDs
    const orgIds = memberData.map(member => member.organization_id)
    // Fetch organizations
    const { data, error } = await supabaseServer
      .from('organizations')
      .select('*')
      .in('id', orgIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ User Organizations API: Error fetching organizations:', {
        error: error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    // Transform the data
    const transformedOrgs = (data || []).map(org => ({
      id: org.id,
      name: org.name,
      description: org.description,
      industry: org.industry,
      size: org.size,
      website: org.website,
      location: org.location,
      created_at: org.created_at,
      updated_at: org.updated_at,
      workspaces: [] // We'll fetch workspaces separately if needed
    }))

    return NextResponse.json(transformedOrgs)

  } catch (error) {
    console.error('❌ User Organizations API: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
