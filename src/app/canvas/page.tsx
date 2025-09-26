import { createServerSupabaseClient } from "@/lib/server-utils";
import { redirect } from "next/navigation";
import CanvasClient from "./canvas-client";
import { SupabaseClient } from "@supabase/supabase-js";

interface CanvasWidget {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config?: unknown;
}

interface Canvas {
  id: string;
  name: string;
  config: {
    widgets: CanvasWidget[];
  };
  created_at: string;
  updated_at: string;
}

async function getCanvasData(
  userId: string,
  supabase: SupabaseClient
): Promise<Canvas | null> {
  try {
    // Get user's most recent canvas
    const { data: canvases, error } = await supabase
      .from("canvases")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching canvas:", error);
      return null;
    }

    return canvases && canvases.length > 0 ? canvases[0] : null;
  } catch (error) {
    console.error("Error in getCanvasData:", error);
    return null;
  }
}

export default async function CanvasPage() {
  // Create server-side Supabase client that can read session cookies
  const supabase = await createServerSupabaseClient();

  // Get user session on server side using secure method
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Fetch canvas data on server side
  const canvas = await getCanvasData(user.id, supabase);

  return (
    <CanvasClient
      initialCanvas={canvas}
      user={{ id: user.id, email: user.email || "" }}
    />
  );
}
