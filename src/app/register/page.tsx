"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const authContext = useSupabaseAuth();
  const {
    signUp,
    signInWithGoogle,
    user,
    isLoading: authLoading,
  } = authContext || {
    signUp: async () => ({ error: { message: "Not authenticated" } }),
    signInWithGoogle: async () => ({ error: { message: "Not authenticated" } }),
    user: null,
    isLoading: false,
  };
  const router = useRouter();
  const pathname = usePathname();

  // Handle OAuth error messages from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get("error");
    
    if (oauthError) {
      switch (oauthError) {
        case "oauth_cancelled":
          setError("Google sign-up was cancelled. Please try again.");
          break;
        case "session_exchange_failed":
          setError("Registration failed. Please try signing up again.");
          break;
        case "unexpected_error":
          setError("An unexpected error occurred. Please try again.");
          break;
        default:
          setError("Registration failed. Please try again.");
      }
      
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user && pathname === "/register") {
      // Add a small delay to prevent race conditions
      const timer = setTimeout(() => {
        router.push("/organizations");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, router, pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData.name
      );
      if (error) {
        // Handle specific error cases
        if (
          error.message?.includes("already registered") ||
          error.message?.includes("User already registered")
        ) {
          setError(
            "An account with this email already exists. Please sign in instead."
          );
        } else if (error.message?.includes("Password should be at least")) {
          setError("Password must be at least 6 characters long.");
        } else if (error.message?.includes("Invalid email")) {
          setError("Please enter a valid email address.");
        } else {
          setError(error.message || "Registration failed. Please try again.");
        }
      } else {
        // Show success message and redirect
        setError(
          "Registration successful! Please check your email to verify your account."
        );
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    setError("");

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message || "Failed to sign up with Google");
      }
    } catch (err) {
      console.error("Google sign up error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-24">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-300 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is authenticated (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 pt-24">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent"></div>

      <div className="relative w-full max-w-sm">
        {/* Main Card */}
        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl mb-3 shadow-lg">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Create your account
            </h1>
            <p className="text-gray-300 text-xs">
              Join Insighter and start analyzing your data
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-start">
                <svg
                  className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-red-400 text-xs">{error}</p>
                  {error.includes("already exists") && (
                    <Link
                      href="/login"
                      className="inline-block mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors underline"
                    >
                      Go to Sign In →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-4">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-medium text-gray-300 mb-1"
              >
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 text-sm"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-gray-300 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 text-sm"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-gray-300 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 text-sm"
                placeholder="Create a password"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-medium text-gray-300 mb-1"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 text-sm"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-gray-900/50 text-gray-400">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google Sign Up Button */}
          <button
            onClick={handleGoogleSignUp}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-2 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Sign In Link */}
          <div className="text-center mt-4">
            <p className="text-gray-300 text-xs">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-gray-400 text-xs">
            By creating an account, you agree to our{" "}
            <Link
              href="/terms"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
