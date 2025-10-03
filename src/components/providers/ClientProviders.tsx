"use client";

import { SupabaseAuthProvider } from "@/contexts/SupabaseAuthContext";
import { PerformanceProvider } from "./PerformanceProvider";
import { LoadingProvider } from "@/contexts/LoadingContext";

interface ClientProvidersProps {
  children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <PerformanceProvider>
      <SupabaseAuthProvider>
        <LoadingProvider>{children}</LoadingProvider>
      </SupabaseAuthProvider>
    </PerformanceProvider>
  );
}
