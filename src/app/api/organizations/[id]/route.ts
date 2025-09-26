import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, checkRateLimit } from '@/lib/server-utils'

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
    console.error('Organization API token verification error:', err)
    return null
  }
}

// Helper function to check if user is owner of organization
async function checkOrganizationOwnership(userId: string, organizationId: string) {
  try {
    const { data: membership, error } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !membership) {
      return false
    }

    return membership.role === 'owner'
  } catch (err) {
    console.error('Error checking organization ownership:', err)
    return false
  }
}

// GET - Get specific organization details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: organizationId } = await params

    // First, check if user is a member of this organization
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (membershipError || !membership) {
      console.error('Error fetching organization membership:', membershipError)
      return NextResponse.json(
        { error: 'Organization not found or access denied' },
        { status: 404 }
      )
    }

    // Get the organization details
    const { data: organization, error: orgError } = await supabaseServer
      .from('organizations')
      .select(`
        *,
        workspaces(
          id,
          name,
          description,
          created_at,
          updated_at,
          status
        )
      `)
      .eq('id', organizationId)
      .eq('status', 'active')
      .single()

    if (orgError || !organization) {
      console.error('Error fetching organization:', orgError)
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const organizationWithRole = {
      ...organization,
      userRole: membership.role,
      workspaces: (organization.workspaces || []).filter((workspace: { status: string }) => workspace.status === 'active')
    }

    return NextResponse.json(organizationWithRole, {
      headers: {
        'Cache-Control': 'private, max-age=60, s-maxage=60',
      }
    })
  } catch (error) {
    console.error('Error in organization GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update organization (owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: organizationId } = await params

    // Check if user is owner
    const isOwner = await checkOrganizationOwnership(user.id, organizationId)
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only organization owners can update organization details' },
        { status: 403 }
      )
    }

    // Rate limiting for PUT requests
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(`${clientIP}-put`, 10, 15 * 60 * 1000) // 10 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900'
          }
        }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }

    console.log(`✏️ Updating organization "${organizationId}" by user: ${user.email} (${user.id})`)

    // Update organization
    const { data: organization, error: orgError } = await supabaseServer
      .from('organizations')
      .update({
        name: body.name,
        description: body.description || null,
        industry: body.industry || null,
        size: body.size || null,
        website: body.website || null,
        location: body.location || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', organizationId)
      .select()
      .single()

    if (orgError) {
      console.error('Error updating organization:', orgError)
      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      )
    }

    return NextResponse.json(organization, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    })
  } catch (error) {
    console.error('Error in organization PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete organization (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify user session
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: organizationId } = await params

    // Check if user is owner
    const isOwner = await checkOrganizationOwnership(user.id, organizationId)
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only organization owners can delete organizations' },
        { status: 403 }
      )
    }

    // Rate limiting for DELETE requests (very restrictive)
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(clientIP + '-delete', 5, 15 * 60 * 1000); // 5 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900'
          }
        }
      )
    }

    console.log(`🗑️ Soft deleting organization "${organizationId}" by user: ${user.email} (${user.id})`)

    // First, get organization name for logging
    await supabaseServer
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    // Soft delete organization (set status to inactive)
    const { error: updateError } = await supabaseServer
      .from('organizations')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', organizationId)

    if (updateError) {
      console.error('Error soft deleting organization:', updateError)
      return NextResponse.json(
        { error: 'Failed to delete organization' },
        { status: 500 }
      )
    }

    // Soft delete all workspaces under this organization
    const { error: workspacesError } = await supabaseServer
      .from('workspaces')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)

    if (workspacesError) {
      console.error('Error deactivating workspaces:', workspacesError)
    }

    // Get all workspace IDs for this organization
    const { data: workspaces } = await supabaseServer
      .from('workspaces')
      .select('id')
      .eq('organization_id', organizationId)

    if (workspaces && workspaces.length > 0) {
      const workspaceIds = workspaces.map(w => w.id)

      // Soft delete all agents under workspaces in this organization
      const { error: agentsError } = await supabaseServer
        .from('ai_agents')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .in('workspace_id', workspaceIds)

      if (agentsError) {
        console.error('Error deactivating agents:', agentsError)
      }

      // Hard delete all data sources (for security)
      const { error: dataSourcesError } = await supabaseServer
        .from('workspace_data_sources')
        .delete()
        .in('workspace_id', workspaceIds)

      if (dataSourcesError) {
        console.error('Error deleting data sources:', dataSourcesError)
      }

      // Hard delete all files (for security)
      const { error: filesError } = await supabaseServer
        .from('file_uploads')
        .delete()
        .in('workspace_id', workspaceIds)

      if (filesError) {
        console.error('Error deleting files:', filesError)
      }
    }

    return NextResponse.json(
      { message: 'Organization deleted successfully' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache',
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    )
  } catch (error) {
    console.error('Error in organization DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
