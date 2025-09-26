import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { encryptObject, decryptObject } from '@/lib/encryption'

// GET - Fetch database connection details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params

    // Fetch database connection with workspace access check
    const { data: connection, error: connectionError } = await supabaseServer
      .from('database_connections')
      .select(`
        *,
        workspaces!inner(
          id,
          name,
          organization_id,
          organization_members!inner(
            user_id,
            status
          )
        )
      `)
      .eq('id', connectionId)
      .eq('workspaces.organization_members.user_id', session.userId)
      .eq('workspaces.organization_members.status', 'active')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Database connection not found' }, { status: 404 })
    }

    // Decrypt connection details
    const decryptedConnection = {
      ...connection,
      host: connection.host_encrypted ? decryptObject(connection.host_encrypted) : connection.host,
      port: connection.port_encrypted ? decryptObject(connection.port_encrypted) : connection.port,
      database: connection.database_encrypted ? decryptObject(connection.database_encrypted) : connection.database,
      username: connection.username_encrypted ? decryptObject(connection.username_encrypted) : connection.username,
      password: connection.password_encrypted ? decryptObject(connection.password_encrypted) : connection.password,
      schema_name: connection.schema_name_encrypted ? decryptObject(connection.schema_name_encrypted) : connection.schema_name,
    }

    return NextResponse.json({
      success: true,
      connection: decryptedConnection
    })

  } catch (error) {
    console.error('Error fetching database connection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update database connection
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params
    const body = await request.json()
    const { name, host, port, database, username, password, schema_name } = body

    // Verify user has access to this connection
    const { data: connection, error: connectionError } = await supabaseServer
      .from('database_connections')
      .select(`
        id,
        workspaces!inner(
          id,
          organization_id,
          organization_members!inner(
            user_id,
            status
          )
        )
      `)
      .eq('id', connectionId)
      .eq('workspaces.organization_members.user_id', session.userId)
      .eq('workspaces.organization_members.status', 'active')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Database connection not found' }, { status: 404 })
    }

    // Prepare update data with encryption
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (host !== undefined) updateData.host_encrypted = encryptObject(host)
    if (port !== undefined) updateData.port_encrypted = encryptObject(port)
    if (database !== undefined) updateData.database_encrypted = encryptObject(database)
    if (username !== undefined) updateData.username_encrypted = encryptObject(username)
    if (password !== undefined) updateData.password_encrypted = encryptObject(password)
    if (schema_name !== undefined) updateData.schema_name_encrypted = encryptObject(schema_name)

    // Update the connection
    const { data: updatedConnection, error: updateError } = await supabaseServer
      .from('database_connections')
      .update(updateData)
      .eq('id', connectionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating database connection:', updateError)
      return NextResponse.json({ error: 'Failed to update database connection' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection updated successfully',
      connection: updatedConnection
    })

  } catch (error) {
    console.error('Error updating database connection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete database connection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params

    // First, get the database connection
    const { data: connection, error: connectionError } = await supabaseServer
      .from('database_connections')
      .select('id, workspace_id')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Database connection not found' }, { status: 404 })
    }

    // Check if user has access to the workspace
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', connection.workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check organization membership
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('id')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', session.userId)
      .eq('status', 'active')
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete the connection (this will cascade delete related data due to foreign key constraints)
    const { error: deleteError } = await supabaseServer
      .from('database_connections')
      .delete()
      .eq('id', connectionId)

    if (deleteError) {
      console.error('Error deleting database connection:', deleteError)
      return NextResponse.json({ error: 'Failed to delete database connection' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting database connection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
