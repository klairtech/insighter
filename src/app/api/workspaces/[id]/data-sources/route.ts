import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseServer } from '@/lib/server-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const { id: workspaceId } = await params;
    console.log('🔍 Data Sources API: Fetching data sources for workspace:', workspaceId);
    
    // Verify user session
    const supabase = await createServerSupabaseClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      console.log('❌ Data Sources API: Unauthorized - no session:', sessionError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('✅ Data Sources API: User authenticated:', session.user.id);

    // Check if user has access to this workspace
    const { data: workspaceAccess, error: accessError } = await supabaseServer
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id)
      .single();

    if (accessError && accessError.code !== 'PGRST116') {
      console.error('❌ Data Sources API: Error checking workspace access:', accessError);
      return NextResponse.json(
        { error: 'Failed to verify workspace access' },
        { status: 500 }
      );
    }
    
    console.log('✅ Data Sources API: Workspace access verified:', !!workspaceAccess);

    if (!workspaceAccess) {
      // Check if user has access through organization membership
      const { data: orgAccess, error: orgAccessError } = await supabaseServer
        .from('workspaces')
        .select(`
          id,
          organizations!inner(
            id,
            organization_members!inner(
              user_id,
              role
            )
          )
        `)
        .eq('id', workspaceId)
        .eq('organizations.organization_members.user_id', session.user.id)
        .single();

      if (orgAccessError || !orgAccess) {
        console.log('❌ Data Sources API: No organization access found');
        return NextResponse.json(
          { error: 'Access denied to this workspace' },
          { status: 403 }
        );
      }
      console.log('✅ Data Sources API: Organization access verified');
    }

    // Fetch workspace data sources
    const { data: workspaceDataSources, error: workspaceError } = await supabaseServer
      .from('workspace_data_sources')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('last_accessed_at', { ascending: false });

    if (workspaceError) {
      console.error('Error fetching workspace data sources:', workspaceError);
      return NextResponse.json(
        { error: 'Failed to fetch data sources' },
        { status: 500 }
      );
    }

    // Fetch database connections
    const { data: databaseConnections, error: dbError } = await supabaseServer
      .from('database_connections')
      .select('id, name, type, is_active, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    if (dbError) {
      console.error('Error fetching database connections:', dbError);
    }

    // Fetch file uploads
    const { data: fileUploads, error: fileError } = await supabaseServer
      .from('file_uploads')
      .select('id, filename, original_name, processing_status, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('processing_status', 'completed');

    if (fileError) {
      console.error('Error fetching file uploads:', fileError);
    }

    // Fetch external connections
    const { data: externalConnections, error: externalError } = await supabaseServer
      .from('external_connections')
      .select('id, name, type, is_active, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    if (externalError) {
      console.error('Error fetching external connections:', externalError);
    }

    // Combine and transform data sources
    const dataSources: Array<{
      id: string;
      name: string;
      type: string;
      source_id: string;
      source_name: string;
      is_active: boolean;
      last_accessed_at: string;
    }> = [];

    // Add database connections
    if (databaseConnections) {
      databaseConnections.forEach(conn => {
        dataSources.push({
          id: `db-${conn.id}`,
          name: conn.name || `${conn.type} Database`,
          type: 'database',
          source_id: conn.id,
          source_name: conn.name,
          is_active: conn.is_active,
          last_accessed_at: conn.updated_at
        });
      });
    }

    // Add file uploads
    if (fileUploads) {
      fileUploads.forEach(file => {
        dataSources.push({
          id: `file-${file.id}`,
          name: file.original_name || file.filename,
          type: 'file',
          source_id: file.id,
          source_name: file.original_name || file.filename,
          is_active: file.processing_status === 'completed',
          last_accessed_at: file.updated_at
        });
      });
    }

    // Add external connections
    if (externalConnections) {
      externalConnections.forEach(conn => {
        dataSources.push({
          id: `external-${conn.id}`,
          name: conn.name || `${conn.type} Connection`,
          type: 'external',
          source_id: conn.id,
          source_name: conn.name,
          is_active: conn.is_active,
          last_accessed_at: conn.updated_at
        });
      });
    }

    // Add workspace data sources that aren't already covered
    if (workspaceDataSources) {
      workspaceDataSources.forEach(source => {
        // Check if this source is already included
        const alreadyIncluded = dataSources.some(ds => 
          ds.source_id === source.source_id && ds.type === source.source_type
        );
        
        if (!alreadyIncluded) {
          dataSources.push({
            id: `workspace-${source.id}`,
            name: source.source_name || `${source.source_type} Source`,
            type: source.source_type as 'database' | 'file' | 'api' | 'external',
            source_id: source.source_id,
            source_name: source.source_name,
            is_active: source.is_active,
            last_accessed_at: source.last_accessed_at
          });
        }
      });
    }

    // Sort by last accessed date (most recent first)
    dataSources.sort((a, b) => {
      if (!a.last_accessed_at && !b.last_accessed_at) return 0;
      if (!a.last_accessed_at) return 1;
      if (!b.last_accessed_at) return -1;
      return new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime();
    });

    console.log('✅ Data Sources API: Returning', dataSources.length, 'data sources');
    
    return NextResponse.json({
      dataSources,
      total: dataSources.length
    });

  } catch (error) {
    console.error('Data sources API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
