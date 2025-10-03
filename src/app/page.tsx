import { Metadata } from "next";
import ServerHome from "@/components/server/ServerHome";
import StructuredData from "@/components/StructuredData";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";

export const metadata: Metadata = generateSEOMetadata({
  title: "Insighter - AI-Powered Data Analytics Platform",
  description:
    "Transform your data into actionable insights with Insighter. Connect databases, process files, and get AI-powered analytics through natural language conversations. Start your free trial today.",
  keywords: [
    "data analytics",
    "business intelligence",
    "AI insights",
    "database analytics",
    "data visualization",
    "natural language processing",
    "data science",
    "analytics platform",
    "data dashboard",
    "business analytics",
  ],
  url: "https://insighter.co.in",
  type: "website",
});

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <ServerHome />
    </>
  );
}
