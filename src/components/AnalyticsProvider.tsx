"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initializeAnalytics, trackPageView } from "@/lib/analytics";

/**
 * Analytics Provider Component
 * Handles initialization and page view tracking
 */
export default function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize analytics on mount
  useEffect(() => {
    initializeAnalytics();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    // Only track on client side to avoid hydration issues
    if (typeof window !== "undefined") {
      const url = `${pathname}${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      trackPageView(url);
    }
  }, [pathname, searchParams]);

  return <>{children}</>;
}
