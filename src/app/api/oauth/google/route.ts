import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
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

    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    // const scopes = searchParams.get('scopes') || 'sheets,docs'

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    // Verify connection exists and user has access
    const { data: connection, error: connectionError } = await supabaseServer
      .from('external_connections')
      .select('id, workspace_id, type')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Check workspace access
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

    // Generate OAuth URL based on connection type
    let authUrl: string
    
    if (connection.type === 'google-sheets') {
      authUrl = GoogleSheetsConnector.getAuthUrl()
    } else if (connection.type === 'google-docs') {
      authUrl = GoogleDocsConnector.getAuthUrl()
    } else if (connection.type === 'google-analytics') {
      const { GoogleAnalyticsConnector } = await import('@/lib/datasources/google-analytics')
      authUrl = GoogleAnalyticsConnector.getAuthUrl()
    } else {
      return NextResponse.json({ error: 'Unsupported connection type for Google OAuth' }, { status: 400 })
    }

    // Add state parameter with connection ID for security
    const state = Buffer.from(JSON.stringify({ 
      connectionId, 
      userId: session.userId,
      timestamp: Date.now()
    })).toString('base64')

    const urlWithState = `${authUrl}&state=${encodeURIComponent(state)}`

    return NextResponse.json({
      success: true,
      authUrl: urlWithState,
      connectionId
    })

  } catch (error) {
    console.error('Google OAuth URL generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code, state, connectionId } = await request.json()

    if (!code || !state || !connectionId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Verify state parameter
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      
      if (stateData.connectionId !== connectionId || stateData.userId !== session.userId) {
        return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
      }

      // Check if state is not too old (5 minutes)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        return NextResponse.json({ error: 'OAuth state expired' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
    }

    // Verify connection exists and user has access
    const { data: connection, error: connectionError } = await supabaseServer
      .from('external_connections')
      .select('id, workspace_id, type')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Check workspace access
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

    // Exchange code for tokens
    let tokens: { access_token: string; refresh_token: string; expires_in: number }
    
    if (connection.type === 'google-sheets') {
      tokens = await GoogleSheetsConnector.exchangeCodeForTokens(code)
    } else if (connection.type === 'google-docs') {
      tokens = await GoogleDocsConnector.exchangeCodeForTokens(code)
    } else if (connection.type === 'google-analytics') {
      const { GoogleAnalyticsConnector } = await import('@/lib/datasources/google-analytics')
      tokens = await GoogleAnalyticsConnector.exchangeCodeForTokens(code)
    } else {
      return NextResponse.json({ error: 'Unsupported connection type for Google OAuth' }, { status: 400 })
    }

    // Encrypt tokens
    const encryptedAccessToken = encryptObject({ token: tokens.access_token })
    const encryptedRefreshToken = tokens.refresh_token ? encryptObject({ token: tokens.refresh_token }) : null

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Store tokens in database
    const { error: tokenError } = await supabaseServer
      .from('oauth_tokens')
      .upsert({
        connection_id: connectionId,
        provider: 'google',
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_type: 'Bearer',
        expires_at: expiresAt,
        scope: connection.type === 'google-sheets' ? 
          ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'] :
          connection.type === 'google-docs' ?
          ['https://www.googleapis.com/auth/documents.readonly', 'https://www.googleapis.com/auth/drive.readonly'] :
          ['https://www.googleapis.com/auth/analytics.readonly']
      }, {
        onConflict: 'connection_id,provider'
      })

    if (tokenError) {
      console.error('Error storing OAuth tokens:', tokenError)
      return NextResponse.json({ error: 'Failed to store OAuth tokens' }, { status: 500 })
    }

    // Update connection status
    await supabaseServer
      .from('external_connections')
      .update({ 
        connection_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)

    console.log(`✅ OAuth tokens stored for connection ${connectionId}`)

    return NextResponse.json({
      success: true,
      message: 'OAuth authentication completed successfully',
      connectionId
    })

  } catch (error) {
    console.error('Google OAuth token exchange error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
