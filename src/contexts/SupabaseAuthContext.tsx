"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  User,
  Session,
  AuthError,
  AuthChangeEvent,
} from "@supabase/supabase-js";

// Create a singleton Supabase client to avoid multiple instances
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

const getSupabaseClient = () => {
  if (!supabaseClient) {
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
  avatar_url?: string;
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

  useEffect(() => {
    // Check for manual signout flag first and clear any existing session
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem("insighter_signout") === "true"
    ) {
      // console.log("Manual signout detected - clearing session immediately");
      setSession(null);
      setUser(null);
      setProfile(null);
      sessionStorage.removeItem("insighter_signout");
      setIsLoading(false);
      return;
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        // Check if we're in the middle of signing out or if user manually signed out
        if (
          isSigningOut ||
          (typeof window !== "undefined" &&
            sessionStorage.getItem("insighter_signout") === "true")
        ) {
          // console.log(
          //   "Skipping initial session check - signing out or manual signout detected"
          // );
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("insighter_signout");
          }
          setIsLoading(false);
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
        } else {
          // console.log("SupabaseAuthContext - Initial session:", {
          //   hasSession: !!session,
          //   hasUser: !!session?.user,
          //   userEmail: session?.user?.email,
          // });
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            await fetchUserProfile(session.user);
          }
        }
      } catch (error) {
        console.error("Error in getInitialSession:", error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        // console.log("Auth state changed:", event, session?.user?.email);

        // Don't restore session if we're in the middle of signing out or if user manually signed out
        if (isSigningOut && event === "SIGNED_OUT") {
          // console.log("Ignoring SIGNED_OUT event during manual signout");
          return;
        }

        // Check for manual signout flag
        if (
          typeof window !== "undefined" &&
          sessionStorage.getItem("insighter_signout") === "true"
        ) {
          // console.log("Ignoring auth state change - manual signout detected");
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

        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, isSigningOut]);

  const fetchUserProfile = async (user: User) => {
    try {
      // Create user profile from Supabase user data
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.name || user.user_metadata?.full_name || "",
        avatar_url:
          user.user_metadata?.avatar_url || user.user_metadata?.picture,
        role: user.user_metadata?.role || "user",
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
      };

      setProfile(userProfile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

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
        console.error("Sign up error:", error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error("Sign up error:", error);
      return { error: error as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error: error as AuthError };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });

      if (error) {
        console.error("Google sign in error:", error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error("Google sign in error:", error);
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      console.log("Starting sign out process...");
      setIsSigningOut(true);

      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);

      // Sign out from Supabase with all scopes
      const { error } = await supabase.auth.signOut({ scope: "global" });

      if (error) {
        console.error("Sign out error:", error);
        // Continue with local cleanup even if global signout fails
      }

      // Also try local signout
      await supabase.auth.signOut({ scope: "local" });

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
      }

      // Wait a bit for cleanup to complete, then force a page reload
      setTimeout(() => {
        if (typeof window !== "undefined") {
          // Set a flag in sessionStorage to prevent auto-restore
          sessionStorage.setItem("insighter_signout", "true");
          window.location.href = "/";
        }
      }, 100);

      console.log("Sign out successful");
      return { error: null };
    } catch (error) {
      console.error("Sign out error:", error);
      setIsSigningOut(false);
      return { error: error as AuthError };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error("Reset password error:", error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error("Reset password error:", error);
      return { error: error as AuthError };
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
          avatar_url: updates.avatar_url,
          role: updates.role,
        },
      });

      if (error) {
        console.error("Update profile error:", error);
        return { error };
      }

      // Update local profile state
      if (data.user) {
        await fetchUserProfile(data.user);
      }

      console.log("Profile updated successfully");
      return { error: null };
    } catch (error) {
      console.error("Update profile error:", error);
      return { error: error as AuthError };
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
    // In development, throw an error to help with debugging
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        "useSupabaseAuth must be used within a SupabaseAuthProvider"
      );
    }
    // In production, return a safe fallback to prevent crashes
    console.warn("useSupabaseAuth called outside of SupabaseAuthProvider");
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
