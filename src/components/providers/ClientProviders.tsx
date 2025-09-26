"use client";

import { SupabaseAuthProvider } from "@/contexts/SupabaseAuthContext";
import { PerformanceProvider } from "./PerformanceProvider";

interface ClientProvidersProps {
  children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <PerformanceProvider>
      <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
    </PerformanceProvider>
  );
}
