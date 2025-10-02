import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { encryptObject, decryptObject } from '@/lib/encryption'

// DELETE - Remove a table from the database schema
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get('tableName')

    if (!tableName) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
    }

    // Verify user has access to this connection
    const { data: connection, error: connectionError } = await supabaseServer
      .from('database_connections')
      .select(`
        id,
        schema_encrypted,
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

    // Decrypt and update schema
    const schema = decryptObject(connection.schema_encrypted) as { tables?: Array<{ name: string }>; views?: Array<{ name: string }> }
    
    // Remove the table from the schema
    if (schema.tables) {
      schema.tables = schema.tables.filter((table: { name: string }) => table.name !== tableName)
    }
    if (schema.views) {
      schema.views = schema.views.filter((view: { name: string }) => view.name !== tableName)
    }

    // Encrypt and save updated schema
    const encryptedSchema = encryptObject(schema)
    
    const { error: updateError } = await supabaseServer
      .from('database_connections')
      .update({
        schema_encrypted: encryptedSchema,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (updateError) {
      console.error('Error updating schema:', updateError)
      return NextResponse.json({ error: 'Failed to remove table from schema' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Table "${tableName}" removed successfully`
    })

  } catch (error) {
    console.error('Error removing table:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new table to the database schema
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: connectionId } = await params
    const body = await request.json()
    const { tableName, tableType = 'table' } = body

    if (!tableName) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
    }

    // Verify user has access to this connection
    const { data: connection, error: connectionError } = await supabaseServer
      .from('database_connections')
      .select(`
        id,
        schema_encrypted,
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

    // Decrypt and update schema
    const schema = decryptObject(connection.schema_encrypted) as { tables?: Array<{ name: string }>; views?: Array<{ name: string }> }
    
    // Add the new table to the schema
    const newTable = {
      name: tableName,
      columns: [],
      ai_definition: null
    }

    if (tableType === 'view') {
      if (!schema.views) schema.views = []
      schema.views.push(newTable)
    } else {
      if (!schema.tables) schema.tables = []
      schema.tables.push(newTable)
    }

    // Encrypt and save updated schema
    const encryptedSchema = encryptObject(schema)
    
    const { error: updateError } = await supabaseServer
      .from('database_connections')
      .update({
        schema_encrypted: encryptedSchema,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (updateError) {
      console.error('Error updating schema:', updateError)
      return NextResponse.json({ error: 'Failed to add table to schema' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${tableType === 'view' ? 'View' : 'Table'} "${tableName}" added successfully`,
      table: newTable
    })

  } catch (error) {
    console.error('Error adding table:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
