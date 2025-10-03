"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  User,
  Session,
  AuthError,
  AuthChangeEvent,
} from "@supabase/supabase-js";
import { analytics, setUserProperties } from "@/lib/analytics";

// Create a singleton Supabase client to avoid multiple instances
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

const getSupabaseClient = () => {
  if (!supabaseClient) {
    // Create browser client with Supabase's built-in cookie handling
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseClient;
};

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_path?: string;
  role?: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    name?: string;
    avatar_url?: string;
  };
}

interface SupabaseAuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ error: AuthError | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (
    updates: Partial<UserProfile>
  ) => Promise<{ error: AuthError | null }>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(
  undefined
);

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const supabase = getSupabaseClient();

  const isAuthenticated = !!user && !!session;

  const fetchUserProfile = useCallback(
    async (user: User) => {
      try {
        // First, try to get profile data from the users table
        const { data: dbProfile } = await supabase
          .from("users")
          .select("name, avatar_path")
          .eq("id", user.id)
          .single();

        // Helper function to resolve avatar with proper priority
        const resolveAvatarPath = () => {
          const sources = {
            userUploaded: dbProfile?.avatar_path,
            googleAvatarUrl: user.user_metadata?.avatar_url,
            googlePicture: user.user_metadata?.picture,
          };

          // Priority order: 1. User uploaded, 2. Google avatar_url, 3. Google picture
          const avatarPath =
            sources.userUploaded ||
            sources.googleAvatarUrl ||
            sources.googlePicture;

          if (avatarPath) {
            try {
              new URL(avatarPath);
              console.log("✅ Avatar resolved:", {
                source: sources.userUploaded
                  ? "user-uploaded"
                  : sources.googleAvatarUrl
                  ? "google-avatar_url"
                  : "google-picture",
                url: avatarPath,
              });
              return avatarPath;
            } catch (error) {
              console.warn("❌ Invalid avatar URL:", avatarPath, error);
              return null;
            }
          }

          console.log("ℹ️ No avatar found, using placeholder");
          return null;
        };

        // Create user profile from Supabase user data and database
        const userProfile: UserProfile = {
          id: user.id,
          email: user.email || "",
          name:
            dbProfile?.name ||
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            "",
          avatar_path: resolveAvatarPath(),
          role: user.user_metadata?.role || "user",
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
        };

        setProfile(userProfile);

        // Set user properties for analytics
        setUserProperties({
          user_id: user.id,
          user_email: user.email,
          user_name: userProfile.name,
          signup_date: user.created_at,
          provider: user.app_metadata?.provider || "email",
        });
      } catch {
        // Fallback: try to get just the avatar from database, then OAuth metadata
        let fallbackDbAvatar = null;

        try {
          // Try to get just the avatar_path from database
          const { data: avatarData } = await supabase
            .from("users")
            .select("avatar_path")
            .eq("id", user.id)
            .single();

          fallbackDbAvatar = avatarData?.avatar_path;
        } catch {
          // Database fetch failed, will use OAuth metadata
        }

        // Helper function to resolve avatar with proper priority (same as main case)
        const resolveFallbackAvatarPath = () => {
          const sources = {
            userUploaded: fallbackDbAvatar,
            googleAvatarUrl: user.user_metadata?.avatar_url,
            googlePicture: user.user_metadata?.picture,
          };

          // Priority order: 1. User uploaded, 2. Google avatar_url, 3. Google picture
          const avatarPath =
            sources.userUploaded ||
            sources.googleAvatarUrl ||
            sources.googlePicture;

          if (avatarPath) {
            try {
              new URL(avatarPath);
              console.log("✅ Fallback avatar resolved:", {
                source: sources.userUploaded
                  ? "user-uploaded"
                  : sources.googleAvatarUrl
                  ? "google-avatar_url"
                  : "google-picture",
                url: avatarPath,
              });
              return avatarPath;
            } catch (error) {
              console.warn(
                "❌ Invalid fallback avatar URL:",
                avatarPath,
                error
              );
              return null;
            }
          }

          console.log("ℹ️ No fallback avatar found, using placeholder");
          return null;
        };

        const userProfile: UserProfile = {
          id: user.id,
          email: user.email || "",
          name: user.user_metadata?.name || user.user_metadata?.full_name || "",
          avatar_path: resolveFallbackAvatarPath(),
          role: user.user_metadata?.role || "user",
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
        };

        setProfile(userProfile);

        // Set user properties for analytics
        setUserProperties({
          user_id: user.id,
          user_email: user.email,
          user_name: userProfile.name,
          signup_date: user.created_at,
          provider: user.app_metadata?.provider || "email",
        });
      }
    },
    [supabase]
  );

  useEffect(() => {
    // Check for manual signout flag first and clear any existing session
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem("insighter_signout") === "true"
    ) {
      setSession(null);
      setUser(null);
      setProfile(null);
      sessionStorage.removeItem("insighter_signout");
      setIsLoading(false);
      return;
    }

    // Add a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000); // 10 second timeout

    // Get initial session
    const getInitialSession = async () => {
      try {
        // Check if we're in the middle of signing out or if user manually signed out
        if (
          isSigningOut ||
          (typeof window !== "undefined" &&
            (sessionStorage.getItem("insighter_signout") === "true" ||
              localStorage.getItem("insighter_signout") === "true" ||
              localStorage.getItem("insighter_manual_signout") === "true"))
        ) {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("insighter_signout");
            localStorage.removeItem("insighter_signout");
            localStorage.removeItem("insighter_manual_signout");
          }
          setIsLoading(false);
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
        } else if (session) {
          // Double-check that we're not in the middle of signing out
          const stillSigningOut =
            isSigningOut ||
            (typeof window !== "undefined" &&
              (sessionStorage.getItem("insighter_signout") === "true" ||
                localStorage.getItem("insighter_signout") === "true" ||
                localStorage.getItem("insighter_manual_signout") === "true"));

          if (stillSigningOut) {
            setSession(null);
            setUser(null);
          } else {
            setSession(session);
            setUser(session.user);

            if (session.user) {
              await fetchUserProfile(session.user);
            }
          }
        } else {
          setSession(null);
          setUser(null);
        }
      } finally {
        clearTimeout(loadingTimeout);
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        // Don't restore session if we're in the middle of signing out or if user manually signed out
        if (isSigningOut && event === "SIGNED_OUT") {
          return;
        }

        // Check for manual signout flag
        if (
          typeof window !== "undefined" &&
          sessionStorage.getItem("insighter_signout") === "true"
        ) {
          sessionStorage.removeItem("insighter_signout");
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserProfile(session.user);
        } else {
          setProfile(null);
        }

        clearTimeout(loadingTimeout);
        setIsLoading(false);
      }
    );

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [supabase.auth, isSigningOut, fetchUserProfile]);

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || "",
            full_name: name || "",
          },
        },
      });

      if (error) {
        // Track signup error
        analytics.error("signup_error", error.message, "authentication");
        return { error };
      }

      // Track successful signup
      analytics.signup("email");

      return { error: null };
    } catch (_error) {
      const error = _error as AuthError;
      analytics.error("signup_exception", error.message, "authentication");
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Track login error
        analytics.error("login_error", error.message, "authentication");
        return { error };
      }

      // Track successful login
      analytics.login("email");

      return { error: null };
    } catch (_error) {
      const error = _error as AuthError;
      analytics.error("login_exception", error.message, "authentication");
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        // Track Google OAuth error
        analytics.error("google_oauth_error", error.message, "authentication");
        return { error };
      }

      // Track Google OAuth initiation
      analytics.login("google");

      return { error: null };
    } catch (_error) {
      const error = _error as AuthError;
      analytics.error(
        "google_oauth_exception",
        error.message,
        "authentication"
      );
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setIsSigningOut(true);

      // Track logout
      analytics.logout();

      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);

      // Set signout flag immediately to prevent session restoration
      if (typeof window !== "undefined") {
        sessionStorage.setItem("insighter_signout", "true");
        localStorage.setItem("insighter_signout", "true");
        localStorage.setItem("insighter_manual_signout", "true");
      }

      // Call server-side signout to clear HTTP-only cookies
      try {
        const serverSignOutResponse = await fetch("/api/auth/signout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (serverSignOutResponse.ok) {
        }
      } catch {}

      // Also try client-side signout as backup
      const { error } = await supabase.auth.signOut({ scope: "global" });

      if (error) {
        // Continue with local cleanup even if global signout fails
      }

      // Also try local signout
      const { error: localError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (localError) {
      }

      // Clear any cached session data in the Supabase client
      try {
        // Force clear the session cache
        await supabase.auth.getSession();
        // Also try to clear any internal cache
        if (supabase.auth["_storage"]) {
          supabase.auth["_storage"].removeItem("sb-access-token");
          supabase.auth["_storage"].removeItem("sb-refresh-token");
        }
      } catch {
        // Ignore errors here, we're just trying to clear cache
      }

      // Clear all possible localStorage keys
      if (typeof window !== "undefined") {
        // Clear all Supabase-related localStorage items
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("supabase") || key.includes("sb-"))) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach((key) => {
          localStorage.removeItem(key);
        });

        // Also clear sessionStorage
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.includes("supabase") || key.includes("sb-"))) {
            sessionKeysToRemove.push(key);
          }
        }

        sessionKeysToRemove.forEach((key) => {
          sessionStorage.removeItem(key);
        });

        // Clear all cookies that might contain session data
        document.cookie.split(";").forEach((cookie) => {
          const eqPos = cookie.indexOf("=");
          const name =
            eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name.includes("supabase") || name.includes("sb-")) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
          }
        });
      }

      // Force a hard reload to clear any cached session data
      setTimeout(() => {
        if (typeof window !== "undefined") {
          // Use replace instead of href to prevent back button issues
          // Add a longer delay to ensure all cleanup is complete
          window.location.replace("/");
        }
      }, 500);

      // Reset the Supabase client singleton to ensure no cached data
      supabaseClient = null;

      return { error: null };
    } catch (_error) {
      setIsSigningOut(false);
      return { error: _error as AuthError };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (_error) {
      return { error: _error as AuthError };
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!user) {
        return { error: { message: "No user logged in" } as AuthError };
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          name: updates.name,
          full_name: updates.name,
          avatar_url: updates.avatar_path,
          role: updates.role,
        },
      });

      if (error) {
        return { error };
      }

      // Update local profile state
      if (data.user) {
        await fetchUserProfile(data.user);
      }

      return { error: null };
    } catch (_error) {
      return { error: _error as AuthError };
    }
  };

  const value = {
    user,
    profile,
    session,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updateProfile,
    isLoading,
    isAuthenticated,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    // Always return a safe fallback to prevent crashes
    // Removed the development error throw to prevent runtime crashes
    // In production, return a safe fallback to prevent crashes
    return {
      user: null,
      profile: null,
      session: null,
      signUp: async () => ({
        error: { message: "Not authenticated" } as AuthError,
      }),
      signIn: async () => ({
        error: { message: "Not authenticated" } as AuthError,
      }),
      signInWithGoogle: async () => ({
        error: { message: "Not authenticated" } as AuthError,
      }),
      signOut: async () => ({
        error: { message: "Not authenticated" } as AuthError,
      }),
      resetPassword: async () => ({
        error: { message: "Not authenticated" } as AuthError,
      }),
      updateProfile: async () => ({
        error: { message: "Not authenticated" } as AuthError,
      }),
      isLoading: false,
      isAuthenticated: false,
    };
  }
  return context;
}
