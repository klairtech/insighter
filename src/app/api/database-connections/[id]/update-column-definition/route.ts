import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { encryptObject, decryptObject } from '@/lib/encryption'

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
    const { tableName, columnName, definition } = await request.json()

    if (!tableName || !columnName || definition === undefined) {
      return NextResponse.json({ error: 'Table name, column name, and definition are required' }, { status: 400 })
    }

    // Get database connection
    const { data: connection, error } = await supabaseServer
      .from('database_connections')
      .select('id, name, workspace_id, schema_info_encrypted')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'Database connection not found' }, { status: 404 })
    }

    // Check if user has access to this workspace
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
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Decrypt and update schema
    let schema: { tables?: Array<{ name: string; columns?: Array<{ name: string; ai_definition?: string }> }>; views?: Array<{ name: string; columns?: Array<{ name: string; ai_definition?: string }> }> }
    try {
      if (connection.schema_info_encrypted) {
        const decryptedSchema = decryptObject(connection.schema_info_encrypted)
        schema = decryptedSchema.schema as { tables?: Array<{ name: string; columns?: Array<{ name: string; ai_definition?: string }> }>; views?: Array<{ name: string; columns?: Array<{ name: string; ai_definition?: string }> }> }
      } else {
        return NextResponse.json({ error: 'No schema data available' }, { status: 404 })
      }
    } catch (decryptError) {
      console.error('Error decrypting schema data:', decryptError)
      return NextResponse.json({ error: 'Failed to decrypt schema data' }, { status: 500 })
    }

    // Update the column definition
    let updated = false

    // Update in tables
    if (schema.tables) {
      for (const table of schema.tables) {
        if (table.name === tableName && table.columns) {
          for (const column of table.columns) {
            if (column.name === columnName) {
              column.ai_definition = definition
              updated = true
              break
            }
          }
        }
      }
    }

    // Update in views
    if (schema.views) {
      for (const view of schema.views) {
        if (view.name === tableName && view.columns) {
          for (const column of view.columns) {
            if (column.name === columnName) {
              column.ai_definition = definition
              updated = true
              break
            }
          }
        }
      }
    }

    if (!updated) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 })
    }

    // Encrypt and save the updated schema
    const encryptedSchema = encryptObject({ schema })

    const { error: updateError } = await supabaseServer
      .from('database_connections')
      .update({
        schema_info_encrypted: encryptedSchema,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    if (updateError) {
      console.error('Error updating database schema:', updateError)
      return NextResponse.json({ error: 'Failed to update schema' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Column definition updated successfully'
    })

  } catch (error) {
    console.error('Error in update column definition API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
