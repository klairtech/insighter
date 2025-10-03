import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, verifyUserSession } from '@/lib/server-utils'
import { encryptObject } from '@/lib/encryption'

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
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get external connections for the workspace
    const { data: connections, error } = await supabaseServer
      .from('external_connections')
      .select('id, name, type, content_type, url, is_active, created_at, updated_at, last_sync, connection_status, content_summary, row_count, column_count')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching external connections:', error)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      connections: connections || []
    })

  } catch (error) {
    console.error('External connections API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const { 
      workspaceId, 
      connectionType, 
      connectionConfig, 
      contentType,
      oauthProvider,
      oauthScopes,
      webScrapingConfig,
      contentFilters,
      syncFrequency = 'manual'
    } = await request.json()

    if (!workspaceId || !connectionType || !connectionConfig) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Check if user has minimum credits (10 credits minimum) for adding data sources
    const { checkUserCredits } = await import('@/lib/credit-service-server')
    const minimumCreditsCheck = await checkUserCredits(session.user.id, 10)
    
    if (!minimumCreditsCheck.hasCredits) {
      console.log(`❌ External Connections API: User has insufficient credits for adding data sources. User has ${minimumCreditsCheck.currentCredits}, needs minimum 10 credits`)
      return NextResponse.json(
        { 
          error: 'Insufficient credits to add data sources',
          currentCredits: minimumCreditsCheck.currentCredits,
          requiredCredits: 10,
          message: 'You need at least 10 credits to add new data sources. Please purchase more credits to continue.'
        },
        { status: 402 } // Payment Required
      )
    }

    // Encrypt sensitive configuration data
    const encryptedConfig = encryptObject(connectionConfig)
    const encryptedWebScrapingConfig = webScrapingConfig ? encryptObject(webScrapingConfig) : null
    const encryptedContentFilters = contentFilters ? encryptObject(contentFilters) : null

    // Save external connection
    const { data: connection, error: connectionError } = await supabaseServer
      .from('external_connections')
      .insert([{
        workspace_id: workspaceId,
        name: connectionConfig.name || `${connectionType} Connection`,
        type: connectionType,
        url: connectionConfig.url || '',
        content_type: contentType || 'api',
        config_encrypted: encryptedConfig,
        oauth_provider: oauthProvider,
        oauth_scopes: oauthScopes || [],
        web_scraping_config: encryptedWebScrapingConfig,
        content_filters: encryptedContentFilters,
        sync_frequency: syncFrequency,
        connection_status: 'active',
        is_active: true
      }])
      .select('id, name, type, content_type, created_at, connection_status')
      .single()

    if (connectionError || !connection) {
      console.error('❌ Error saving external connection:', connectionError)
      console.error('❌ Connection error details:', {
        message: connectionError?.message,
        details: connectionError?.details,
        hint: connectionError?.hint,
        code: connectionError?.code
      })
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
    }

    console.log(`✅ External connection created successfully: ${connection.id} for workspace ${workspaceId}`)

    // Add to workspace_data_sources so agents can find it
    const { error: dataSourceError } = await supabaseServer
      .from('workspace_data_sources')
      .insert({
        workspace_id: workspaceId,
        source_type: contentType || 'api',
        source_id: connection.id,
        source_name: connectionConfig.name || `${connectionType} Connection`,
        is_active: true,
        last_accessed_at: new Date().toISOString()
      })

    if (dataSourceError) {
      console.error('Error adding to workspace_data_sources:', dataSourceError)
      // Don't fail the request, just log the error
    } else {
      console.log(`✅ Added external connection to workspace_data_sources`)
    }

    return NextResponse.json({
      success: true,
      connection,
      connectionId: connection.id,
      message: 'External connection setup completed successfully'
    })

  } catch (error) {
    console.error('External connection setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
