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

    // Fetch enabled data source configurations for database and file types
    const { data: dataSourceConfigs, error: configError } = await supabase
      .from('data_source_config')
      .select('*')
      .eq('is_enabled', true)
      .in('category', ['sql', 'nosql', 'file'])
      .order('sort_order', { ascending: true });

    if (configError) {
      console.error("Database error:", configError);
      return NextResponse.json(
        { error: "Failed to fetch database configurations" },
        { status: 500 }
      );
    }

    // Transform the data to match the frontend format
    const databaseSources = dataSourceConfigs?.map(config => ({
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
      dataSources: databaseSources,
      total: databaseSources.length
    });

  } catch (error) {
    console.error("Database config error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
