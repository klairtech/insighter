import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, createServerSupabaseClient } from '@/lib/server-utils'
import { encryptObject } from '@/lib/encryption'
import { GoogleSheetsConnector } from '@/lib/datasources/google-sheets'
import { GoogleDocsConnector } from '@/lib/datasources/google-docs'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.redirect(new URL('/error?message=Database not configured', request.url))
    }

    // Create server-side Supabase client that can read session cookies
    const supabase = await createServerSupabaseClient()
    
    // Get user session from cookies
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth error
    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(new URL(`/workspaces?error=${encodeURIComponent('OAuth authorization failed')}`, request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/workspaces?error=Missing OAuth parameters', request.url))
    }

    // Verify state parameter
    let stateData
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      
      if (stateData.userId !== user.id) {
        return NextResponse.redirect(new URL('/workspaces?error=Invalid OAuth state', request.url))
      }

      // Check if state is not too old (5 minutes)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        return NextResponse.redirect(new URL('/workspaces?error=OAuth state expired', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/workspaces?error=Invalid OAuth state', request.url))
    }

    const { workspaceId, connectionType, documentId } = stateData

    // Check workspace access
    const { data: workspace, error: workspaceError } = await supabaseServer
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.redirect(new URL('/workspaces?error=Workspace not found', request.url))
    }

    // Check organization membership
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('id')
      .eq('organization_id', workspace.organization_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.redirect(new URL('/workspaces?error=Access denied', request.url))
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
      return NextResponse.redirect(new URL('/workspaces?error=Unsupported connection type', request.url))
    }

    // Encrypt tokens
    const encryptedAccessToken = encryptObject({ token: tokens.access_token })
    const encryptedRefreshToken = tokens.refresh_token ? encryptObject({ token: tokens.refresh_token }) : null

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Now create the connection with the OAuth tokens
    console.log('🔐 Creating connection for workspace:', workspaceId, 'type:', connectionType)
    
    // Create external connection
    const { data: connection, error: connectionError } = await supabaseServer
      .from('external_connections')
      .insert([{
        workspace_id: workspaceId,
        name: `${connectionType} Connection`,
        type: connectionType,
        url: '',
        content_type: connectionType === 'google-docs' ? 'document' : 'api',
        config_encrypted: encryptObject({
          ...(documentId && { documentId })
        }),
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
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>OAuth Error</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_ERROR',
                  message: 'Failed to create connection: ${connectionError?.message || 'Unknown error'}'
                }, '*');
                window.close();
              } else {
                window.location.href = '/workspaces?error=Failed to create connection';
              }
            </script>
            <p>Connection failed! This window will close automatically.</p>
            <p>Error: ${connectionError?.message || 'Unknown error'}</p>
          </body>
        </html>
      `;
      return new NextResponse(errorHtml, { headers: { 'Content-Type': 'text/html' } })
    }

    // Store tokens in database
    console.log('🔐 Storing OAuth tokens for connection:', connection.id)
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
      console.error('❌ Error storing OAuth tokens:', tokenError)
      console.error('❌ Token error details:', {
        message: tokenError.message,
        details: tokenError.details,
        hint: tokenError.hint,
        code: tokenError.code
      })
      
      // Return error page that can close popup
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>OAuth Error</title>
          </head>
          <body>
            <script>
              // Notify parent window of error
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_ERROR',
                  message: 'Failed to store OAuth tokens: ${tokenError.message}'
                }, '*');
                window.close();
              } else {
                // Fallback if not in popup
                window.location.href = '/organizations?error=Failed to store OAuth tokens';
              }
            </script>
            <p>Connection failed! This window will close automatically.</p>
            <p>Error: ${tokenError.message}</p>
          </body>
        </html>
      `;
      
      return new NextResponse(errorHtml, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Add to workspace_data_sources so agents can find it
    const { error: dataSourceError } = await supabaseServer
      .from('workspace_data_sources')
      .insert({
        workspace_id: workspaceId,
        source_type: connectionType === 'google-docs' ? 'document' : 'api',
        source_id: connection.id,
        source_name: `${connectionType} Connection`,
        is_active: true,
        last_accessed_at: new Date().toISOString()
      })

    if (dataSourceError) {
      console.error('Error adding to workspace_data_sources:', dataSourceError)
      // Don't fail the request, just log the error
    }

    console.log(`✅ OAuth connection created successfully: ${connection.id}`)

    // Connection is already created with active status, no need to update

    console.log(`✅ OAuth tokens stored for connection ${connection.id}`)

    // Close popup and notify parent window
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Success</title>
        </head>
        <body>
          <script>
            // Notify parent window of success
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_SUCCESS',
                message: 'Google connection established successfully'
              }, '*');
              window.close();
            } else {
              // Fallback if not in popup
              window.location.href = '/workspaces/${workspaceId}?success=Google connection established successfully';
            }
          </script>
          <p>Connection successful! This window will close automatically.</p>
        </body>
      </html>
    `;
    
    return new NextResponse(successHtml, {
      headers: { 'Content-Type': 'text/html' }
    })

  } catch (error) {
    console.error('Google OAuth callback error:', error)
    
    // Return error page that can close popup
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Error</title>
        </head>
        <body>
          <script>
            // Notify parent window of error
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_ERROR',
                message: 'OAuth callback failed'
              }, '*');
              window.close();
            } else {
              // Fallback if not in popup
              window.location.href = '/organizations?error=OAuth callback failed';
            }
          </script>
          <p>Connection failed! This window will close automatically.</p>
        </body>
      </html>
    `;
    
    return new NextResponse(errorHtml, {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}
