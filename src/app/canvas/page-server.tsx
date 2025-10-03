import { supabaseServer } from "@/lib/server-utils";
import { redirect } from "next/navigation";
import CanvasClient from "./canvas-client";

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

async function getCanvasData(userId: string): Promise<Canvas | null> {
  try {
    // Get user's most recent canvas
    const { data: canvases, error } = await supabaseServer
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
  // Get user session on server side
  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Fetch canvas data on server side
  const canvas = await getCanvasData(user.id);

  return (
    <CanvasClient
      initialCanvas={canvas}
      user={{ id: user.id, email: user.email || "" }}
    />
  );
}
