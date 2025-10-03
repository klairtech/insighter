import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";
import AboutUsClient from "./about-us-client";

export const metadata: Metadata = generateSEOMetadata({
  title: "About Us - Our Story & Mission",
  description:
    "Learn about Insighter's mission to transform data analytics through AI. Meet our team, discover our story, and understand how we're revolutionizing business intelligence.",
  keywords: [
    "about insighter",
    "company story",
    "data analytics team",
    "AI company",
    "business intelligence mission",
    "data science company",
    "analytics platform team",
  ],
  url: "https://insighter.co.in/about-us",
  type: "website",
});

export default function AboutUsPage() {
  return <AboutUsClient />;
}
