import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workspaceId } = await params

    // Check if user has access to this workspace
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check if user has organization-level access
    const { data: orgMembership } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', session.userId)
      .eq('organization_id', workspace.organization_id)
      .eq('status', 'active')
      .single()

    // Check if user has workspace-specific access
    const { data: workspaceMembership } = await supabaseServer
      .from('workspace_members')
      .select('role')
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single()

    // User has access if they have either organization or workspace-specific access
    const membership = orgMembership || workspaceMembership
    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get database connections for this workspace
    console.log(`🔍 Fetching database connections for workspace: ${workspaceId}`)
    
    const { data: connections, error: connectionsError } = await supabaseServer
      .from('database_connections')
      .select('id, name, type, host, port, database, username, is_active, created_at, updated_at, last_schema_sync, schema_version, schema_name')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (connectionsError) {
      console.error('❌ Database connections fetch error:', connectionsError)
      return NextResponse.json({ error: 'Failed to fetch database connections' }, { status: 500 })
    }

    console.log(`✅ Found ${connections?.length || 0} database connections for workspace ${workspaceId}`)
    if (connections && connections.length > 0) {
      console.log('📋 Connections:', connections.map(c => ({ id: c.id, name: c.name, type: c.type })))
    }
    
    const response = NextResponse.json(connections || [])
    
    // Ensure no caching for real-time data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response

  } catch (error) {
    console.error('Get database connections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workspaceId } = await params
    const { name, type, host, port, database, username, password } = await request.json()

    // Validate required fields
    if (!name || !type || !host || !port || !database || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check workspace access
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check if user has organization-level access
    const { data: orgMembership } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', session.userId)
      .eq('organization_id', workspace.organization_id)
      .eq('status', 'active')
      .single()

    // Check if user has workspace-specific access
    const { data: workspaceMembership } = await supabaseServer
      .from('workspace_members')
      .select('role')
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single()

    // User has access if they have either organization or workspace-specific access
    const membership = orgMembership || workspaceMembership
    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create database connection
    const { data: connection, error: createError } = await supabaseServer
      .from('database_connections')
      .insert([{
        name,
        type,
        host,
        port: parseInt(port),
        database,
        username,
        password_encrypted: password,
        workspace_id: workspaceId,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (createError) {
      console.error('Error creating database connection:', createError)
      return NextResponse.json({ error: 'Failed to create database connection' }, { status: 500 })
    }

    const response = NextResponse.json({
      ...connection,
      message: 'Database connection created successfully'
    }, { status: 201 })
    
    // Ensure no caching for real-time data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response

  } catch (error) {
    console.error('Create database connection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
