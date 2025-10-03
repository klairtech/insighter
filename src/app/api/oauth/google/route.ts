import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, createServerSupabaseClient } from '@/lib/server-utils'
import { encryptObject } from '@/lib/encryption'
import { GoogleSheetsConnector } from '@/lib/datasources/google-sheets'
import { GoogleDocsConnector } from '@/lib/datasources/google-docs'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient()
    
    // Get user session from cookies
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const connectionType = searchParams.get('connectionType') || 'google-docs'
    const documentId = searchParams.get('documentId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
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

    // Check organization membership
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('id')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Generate OAuth URL based on connection type
    let authUrl: string
    
    if (connectionType === 'google-sheets') {
      authUrl = GoogleSheetsConnector.getAuthUrl()
    } else if (connectionType === 'google-docs') {
      authUrl = GoogleDocsConnector.getAuthUrl()
    } else if (connectionType === 'google-analytics') {
      const { GoogleAnalyticsConnector } = await import('@/lib/datasources/google-analytics')
      authUrl = GoogleAnalyticsConnector.getAuthUrl()
    } else {
      return NextResponse.json({ error: 'Unsupported connection type for Google OAuth' }, { status: 400 })
    }

        // Add state parameter with workspace and connection info for security
        const state = Buffer.from(JSON.stringify({ 
          workspaceId,
          connectionType,
          userId: user.id,
          timestamp: Date.now(),
          ...(documentId && { documentId })
        })).toString('base64')

    const urlWithState = `${authUrl}&state=${encodeURIComponent(state)}`

    // Return the OAuth URL for popup to navigate to
    return NextResponse.json({ 
      success: true, 
      authUrl: urlWithState,
      workspaceId,
      connectionType
    })

  } catch (error) {
    console.error('Google OAuth URL generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient()
    
    // Get user session from cookies
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code, state, connectionConfig } = await request.json()

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Verify state parameter
    let stateData: any
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      
      if (stateData.userId !== user.id) {
        return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
      }

      // Check if state is not too old (5 minutes)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        return NextResponse.json({ error: 'OAuth state expired' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
    }

    const { workspaceId, connectionType, documentId } = stateData

    // Check workspace access
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check organization membership
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('id')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Exchange code for tokens
    let tokens: { access_token: string; refresh_token: string; expires_in: number }
    
    if (connectionType === 'google-sheets') {
      tokens = await GoogleSheetsConnector.exchangeCodeForTokens(code)
    } else if (connectionType === 'google-docs') {
      tokens = await GoogleDocsConnector.exchangeCodeForTokens(code)
    } else if (connectionType === 'google-analytics') {
      const { GoogleAnalyticsConnector } = await import('@/lib/datasources/google-analytics')
      tokens = await GoogleAnalyticsConnector.exchangeCodeForTokens(code)
    } else {
      return NextResponse.json({ error: 'Unsupported connection type for Google OAuth' }, { status: 400 })
    }

    // Now create the connection with the OAuth tokens
    const { encryptObject } = await import('@/lib/encryption')
    const encryptedConfig = encryptObject({
      ...(connectionConfig || {}),
      ...(documentId && { documentId })
    })

    // Create external connection
    const { data: connection, error: connectionError } = await supabaseServer
      .from('external_connections')
      .insert([{
        workspace_id: workspaceId,
        name: connectionConfig?.name || `${connectionType} Connection`,
        type: connectionType,
        url: connectionConfig?.url || '',
        content_type: connectionType === 'google-docs' ? 'document' : 'api',
        config_encrypted: encryptedConfig,
        oauth_provider: 'google',
        oauth_scopes: connectionType === 'google-sheets' ? 
          ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'] :
          connectionType === 'google-docs' ?
          ['https://www.googleapis.com/auth/documents.readonly', 'https://www.googleapis.com/auth/drive.readonly'] :
          ['https://www.googleapis.com/auth/analytics.readonly'],
        connection_status: 'active',
        is_active: true
      }])
      .select('id, name, type, content_type, created_at, connection_status')
      .single()

    if (connectionError || !connection) {
      console.error('❌ Error creating external connection:', connectionError)
      return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
    }

    // Encrypt tokens
    const encryptedAccessToken = encryptObject({ token: tokens.access_token })
    const encryptedRefreshToken = tokens.refresh_token ? encryptObject({ token: tokens.refresh_token }) : null

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Store tokens in database
    const { error: tokenError } = await supabaseServer
      .from('oauth_tokens')
      .insert({
        connection_id: connection.id,
        provider: 'google',
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_type: 'Bearer',
        expires_at: expiresAt,
        scope: connectionType === 'google-sheets' ? 
          ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'] :
          connectionType === 'google-docs' ?
          ['https://www.googleapis.com/auth/documents.readonly', 'https://www.googleapis.com/auth/drive.readonly'] :
          ['https://www.googleapis.com/auth/analytics.readonly']
      })

    if (tokenError) {
      console.error('Error storing OAuth tokens:', tokenError)
      return NextResponse.json({ error: 'Failed to store OAuth tokens' }, { status: 500 })
    }

    // Add to workspace_data_sources so agents can find it
    const { error: dataSourceError } = await supabaseServer
      .from('workspace_data_sources')
      .insert({
        workspace_id: workspaceId,
        source_type: connectionType === 'google-docs' ? 'document' : 'api',
        source_id: connection.id,
        source_name: connectionConfig?.name || `${connectionType} Connection`,
        is_active: true,
        last_accessed_at: new Date().toISOString()
      })

    if (dataSourceError) {
      console.error('Error adding to workspace_data_sources:', dataSourceError)
      // Don't fail the request, just log the error
    }

    console.log(`✅ OAuth connection created successfully: ${connection.id}`)

    return NextResponse.json({
      success: true,
      message: 'OAuth authentication completed successfully',
      connectionId: connection.id
    })

  } catch (error) {
    console.error('Google OAuth token exchange error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
