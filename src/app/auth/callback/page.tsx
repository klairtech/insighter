"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { createClient } from "@supabase/supabase-js";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useSupabaseAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the code and error from URL parameters
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // Handle OAuth error (user cancelled or denied access)
        if (error) {
          console.error("OAuth error:", error, errorDescription);
          setError(errorDescription || "Authentication failed");
          
          // Track the error
          if (authContext) {
            const { analytics } = await import("@/lib/analytics");
            analytics.error("oauth_cancelled", error, "authentication");
          }
          
          // Redirect to login page after a short delay
          setTimeout(() => {
            router.push("/login?error=oauth_cancelled");
          }, 2000);
          return;
        }

        // Handle successful OAuth callback
        if (code) {
          // Create a Supabase client to handle the OAuth callback
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );

          // Exchange the code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error("Session exchange error:", exchangeError);
            setError("Failed to complete authentication");
            
            // Track the error
            if (authContext) {
              const { analytics } = await import("@/lib/analytics");
              analytics.error("session_exchange_error", exchangeError.message, "authentication");
            }
            
            // Redirect to login page
            setTimeout(() => {
              router.push("/login?error=session_exchange_failed");
            }, 2000);
            return;
          }

          if (data.session && data.user) {
            // Track successful authentication
            if (authContext) {
              const { analytics } = await import("@/lib/analytics");
              analytics.login("google");
            }

            // Redirect to organizations page on success
            router.push("/organizations");
            return;
          }
        }

        // If no code or error, redirect to login
        router.push("/login");
      } catch (err) {
        console.error("Auth callback error:", err);
        setError("An unexpected error occurred");
        
        // Track the error
        if (authContext) {
          const { analytics } = await import("@/lib/analytics");
          analytics.error("auth_callback_exception", String(err), "authentication");
        }
        
        // Redirect to login page
        setTimeout(() => {
          router.push("/login?error=unexpected_error");
        }, 2000);
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [router, searchParams, authContext]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Completing authentication...
          </h2>
          <p className="text-foreground-muted">
            Please wait while we finish setting up your account.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <div className="text-destructive text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Authentication Failed
            </h2>
            <p className="text-foreground-muted mb-4">
              {error}
            </p>
            <p className="text-sm text-foreground-muted">
              Redirecting you back to the login page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
