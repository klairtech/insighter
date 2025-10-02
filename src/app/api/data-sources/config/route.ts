import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function GET() {
  try {
    // Create server-side Supabase client
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch enabled data source configurations for all categories
    const { data: dataSourceConfigs, error: configError } = await supabase
      .from('data_source_config')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (configError) {
      console.error("Database error:", configError);
      return NextResponse.json(
        { error: "Failed to fetch data source configurations" },
        { status: 500 }
      );
    }

    // Transform the data to match the frontend format
    const enabledDataSources = dataSourceConfigs?.map(config => ({
      id: config.source_id,
      name: config.name,
      category: config.category,
      icon: config.icon_url,
      color: config.color_class,
      defaultPort: config.default_port,
      description: config.description,
      isBeta: config.is_beta,
      releaseNotes: config.release_notes
    })) || [];

    return NextResponse.json({
      dataSources: enabledDataSources,
      total: enabledDataSources.length
    });

  } catch (error) {
    console.error("Data source config error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Admin endpoint to update data source configurations
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // TODO: Add admin role check here
    // For now, we'll allow any authenticated user to update configs
    // In production, you should check if the user has admin privileges

    const body = await request.json();
    const { sourceId, isEnabled, isBeta, releaseNotes } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "sourceId is required" },
        { status: 400 }
      );
    }

    // Update the data source configuration
    const { data, error } = await supabase
      .from('data_source_config')
      .update({
        is_enabled: isEnabled,
        is_beta: isBeta,
        release_notes: releaseNotes,
        updated_at: new Date().toISOString()
      })
      .eq('source_id', sourceId)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to update data source configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dataSource: data
    });

  } catch (error) {
    console.error("Data source config update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
