import { generatePageMetadata } from "@/lib/server-utils";
import { Metadata } from "next";
import ClientHome from "./ClientHome";

// Server-side metadata generation
export const metadata: Metadata = generatePageMetadata({
  title: "AI-Powered Data Analytics Platform",
  description:
    "Transform complex data into actionable insights with AI-powered natural language queries. No SQL knowledge required.",
  keywords: [
    "data analytics",
    "AI",
    "business intelligence",
    "natural language queries",
  ],
});

// Server-side skeleton component removed as unused

// Main server component
export default function ServerHome() {
  return <ClientHome />;
}
