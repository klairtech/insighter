"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import { useLoading } from "@/contexts/LoadingContext";
import LoadingButton from "@/components/ui/LoadingButton";
import { LoadingLink } from "@/components/ui/LoadingButton";
import {
  Menu,
  X,
  User,
  Settings,
  LogOut,
  ChevronDown,
  LogIn,
  Bell,
  CreditCard,
} from "lucide-react";
import CreditBalance from "./CreditBalance";
import LogoRobust from "./LogoRobust";
import { usePremiumMembership } from "@/hooks/usePremiumMembership";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  size?: string;
  website?: string;
  location?: string;
  created_at: string;
  updated_at: string;
  workspaces: Workspace[];
}

// interface User {
//   id: string;
//   email: string;
//   name?: string;
//   avatar_path?: string;
// }

const Navigation: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const authContext = useSupabaseAuth();
  const { isLoading: _isLoading } = useLoading();
  const { user, session, profile, signOut } = authContext || {
    user: null,
    session: null,
    profile: null,
    signOut: () => {},
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);

  // Premium membership status
  const { isPremium, membership: _membership } = usePremiumMembership();

  // Handle hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Create Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const isActive = (path: string) => pathname === path;

  const loadUserData = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setOrgsError(null);
      return;
    }

    // Cache organizations for 30 seconds to avoid unnecessary requests
    const now = Date.now();
    if (organizations.length > 0 && now - lastLoadTime < 30000) {
      return;
    }

    setIsLoadingOrgs(true);
    setOrgsError(null);

    try {
      // Use the optimized API endpoint first (server-side with service role)
      if (!session?.access_token) {
        setOrgsError("No session token available");
        setOrganizations([]);
        return;
      }

      const response = await fetch("/api/user/organizations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const apiOrgs = await response.json();
      setOrganizations(apiOrgs);
      setOrgsError(null);
      setLastLoadTime(now);
    } catch (apiError) {
      console.warn(
        "API request failed, trying direct Supabase query:",
        apiError
      );

      // Fallback to direct Supabase query (slower but more reliable)
      try {
        const { data: memberData, error: memberError } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active");

        if (memberError) {
          throw new Error("Direct query failed");
        }

        if (!memberData || memberData.length === 0) {
          setOrganizations([]);
          return;
        }

        // Extract organization IDs
        const orgIds = memberData.map((member) => member.organization_id);

        // Fetch organizations (only active ones)
        const { data, error } = await supabase
          .from("organizations")
          .select("*")
          .in("id", orgIds)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error("Organizations query failed");
        }

        // Transform the data to match our interface
        const transformedOrgs: Organization[] = (data || []).map(
          (org: {
            id: string;
            name: string;
            description?: string;
            industry?: string;
            size?: string;
            website?: string;
            location?: string;
            created_at: string;
            updated_at: string;
          }) => ({
            id: org.id,
            name: org.name,
            description: org.description,
            industry: org.industry,
            size: org.size,
            website: org.website,
            location: org.location,
            created_at: org.created_at,
            updated_at: org.updated_at,
            workspaces: [], // We'll fetch workspaces separately if needed
          })
        );

        setOrganizations(transformedOrgs);
        setOrgsError(null);
        setLastLoadTime(now);
      } catch (directQueryError) {
        console.error("Both API and direct query failed:", directQueryError);
        setOrgsError("Failed to load organizations");
        setOrganizations([]);
      }
    } finally {
      setIsLoadingOrgs(false);
    }
  }, [user, session, supabase, organizations.length, lastLoadTime]);

  const loadPendingInvitations = useCallback(async () => {
    if (!user || !session) {
      setPendingInvitations(0);
      return;
    }

    try {
      // Use access_token from Supabase session
      const token = session?.access_token;

      if (!token) {
        return;
      }

      const response = await fetch("/api/user/invitations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const invitations = await response.json();
        setPendingInvitations(invitations.length);
      } else {
        // Try to get more details about the error
        try {
          const _errorData = await response.json();
        } catch {}
      }
    } catch {}
  }, [user, session]);

  useEffect(() => {
    if (user && session) {
      loadUserData();
      loadPendingInvitations();
    } else if (!user) {
      // Clear data when user logs out
      setOrganizations([]);
      setOrgsError(null);
      setPendingInvitations(0);
    }
  }, [user, session, loadUserData, loadPendingInvitations]);

  // Add retry mechanism for failed organization loads
  useEffect(() => {
    if (orgsError && user && session && !isLoadingOrgs) {
      const retryTimer = setTimeout(() => {
        console.log("Retrying organization load after error...");
        loadUserData();
      }, 3000); // Retry after 3 seconds

      return () => clearTimeout(retryTimer);
    }
  }, [orgsError, user, session, isLoadingOrgs, loadUserData]);

  const _handleLogout = () => {
    signOut();
    setIsMenuOpen(false);
    setIsOrgDropdownOpen(false);
    setIsProfileDropdownOpen(false);
    window.location.href = "/";
  };

  return (
    <header className="fixed top-0 w-full bg-background backdrop-blur-md border-b border-white/10 z-50">
      <div className="w-full px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <LoadingLink
            href="/"
            loadingKey="nav-logo"
            className="flex items-center"
            router={router}
          >
            <LogoRobust variant="white" size="2xl" showText={false} />
          </LoadingLink>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <LoadingLink
              href="/"
              loadingKey="nav-home-desktop"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive("/")
                  ? "text-blue-400 bg-blue-500/10"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
              router={router}
            >
              Home
            </LoadingLink>

            {isClient && user ? (
              <>
                <div className="relative">
                  <button
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center ${
                      isActive("/organizations")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                  >
                    Organizations
                    <svg
                      className="ml-1 h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isOrgDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg py-2 z-50">
                      <LoadingLink
                        href="/organizations"
                        loadingKey="nav-organizations"
                        className="block px-4 py-2 text-sm text-blue-300 hover:text-blue-200 hover:bg-white/10 transition-colors border-b border-gray-600"
                        onClick={() => setIsOrgDropdownOpen(false)}
                        router={router}
                      >
                        <div className="font-medium">
                          View All Organizations
                        </div>
                        <div className="text-xs text-gray-300">
                          Manage your organizations
                        </div>
                      </LoadingLink>

                      {/* Loading State */}
                      {isLoadingOrgs && (
                        <div className="px-4 py-3 text-sm text-gray-300">
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                            <span>Loading organizations...</span>
                          </div>
                        </div>
                      )}

                      {/* Error State */}
                      {orgsError && !isLoadingOrgs && (
                        <div className="px-4 py-3 text-sm text-red-300">
                          <div className="mb-2">
                            Failed to load organizations
                          </div>
                          <div className="text-xs text-gray-400 mb-2">
                            {orgsError}
                          </div>
                          <button
                            onClick={() => loadUserData()}
                            className="text-blue-400 hover:text-blue-300 text-xs underline"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {/* Organizations List */}
                      {!isLoadingOrgs &&
                        !orgsError &&
                        organizations.length > 0 &&
                        organizations.map((org) => (
                          <Link
                            key={org.id}
                            href={`/organizations/${org.id}`}
                            className="block px-4 py-2 text-sm text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
                            onClick={() => setIsOrgDropdownOpen(false)}
                          >
                            <div className="font-medium">{org.name}</div>
                            {org.description && (
                              <div className="text-xs text-gray-300">
                                {org.description}
                              </div>
                            )}
                          </Link>
                        ))}

                      {/* Empty State */}
                      {!isLoadingOrgs &&
                        !orgsError &&
                        organizations.length === 0 && (
                          <div className="px-4 py-2 text-sm text-gray-300">
                            <div className="mb-2">No organizations found</div>
                            <LoadingLink
                              href="/organizations"
                              loadingKey="nav-create-org"
                              className="text-blue-400 hover:text-blue-300 text-xs underline"
                              onClick={() => setIsOrgDropdownOpen(false)}
                              router={router}
                            >
                              Create your first organization
                            </LoadingLink>
                          </div>
                        )}
                    </div>
                  )}
                </div>

                <LoadingLink
                  href="/pricing"
                  loadingKey="nav-pricing-desktop"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive("/pricing")
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                  router={router}
                >
                  Pricing
                </LoadingLink>

                <LoadingLink
                  href="/chat"
                  loadingKey="nav-chat-desktop"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive("/chat")
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                  router={router}
                >
                  Chat
                </LoadingLink>

                {/* Credit Balance - only show if authenticated */}
                {user && session && <CreditBalance className="px-3 py-2" />}

                {/* User Profile or Login Button */}
                {user && session ? (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setIsProfileDropdownOpen(!isProfileDropdownOpen)
                      }
                      className="flex items-center space-x-2 text-white/80 hover:text-white px-3 py-2 rounded-lg transition-colors duration-200 hover:bg-white/10"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                        {profile?.avatar_path ? (
                          <Image
                            src={profile.avatar_path}
                            alt="Profile"
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Hide the broken image and show fallback
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const fallback =
                                target.nextElementSibling as HTMLElement;
                              if (fallback) {
                                fallback.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-full h-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center ${
                            profile?.avatar_path ? "hidden" : "flex"
                          }`}
                        >
                          <User className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="flex flex-col items-start">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {profile?.name ||
                              user?.email?.split("@")[0] ||
                              "User"}
                          </span>
                          {isPremium && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400/30">
                              <svg
                                className="w-3 h-3 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Premium
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-neutral-400">
                          {user?.email}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Profile Dropdown - only show if authenticated */}
                    {isProfileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-black/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl z-50">
                        <div className="py-2">
                          <Link
                            href="/profile"
                            className="flex items-center px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                            onClick={() => setIsProfileDropdownOpen(false)}
                          >
                            <User className="w-4 h-4 mr-3" />
                            Profile
                          </Link>
                          <Link
                            href="/profile"
                            className="flex items-center px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                            onClick={() => setIsProfileDropdownOpen(false)}
                          >
                            <Settings className="w-4 h-4 mr-3" />
                            Settings
                          </Link>
                          <Link
                            href="/billing"
                            className="flex items-center px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                            onClick={() => setIsProfileDropdownOpen(false)}
                          >
                            <CreditCard className="w-4 h-4 mr-3" />
                            Billing & Credits
                          </Link>
                          <Link
                            href="/invitations"
                            className="flex items-center px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                            onClick={() => setIsProfileDropdownOpen(false)}
                          >
                            <Bell className="w-4 h-4 mr-3" />
                            Invitations
                            {pendingInvitations > 0 && (
                              <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                {pendingInvitations > 9
                                  ? "9+"
                                  : pendingInvitations}
                              </span>
                            )}
                          </Link>
                          <div className="border-t border-white/10 my-1"></div>
                          <button
                            onClick={signOut}
                            className="flex items-center w-full px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <LogOut className="w-4 h-4 mr-3" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center space-x-2 text-white/80 hover:text-white px-3 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors duration-200"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="text-sm font-medium">Login</span>
                  </Link>
                )}
              </>
            ) : isClient ? (
              <>
                <Link
                  href="/about-us"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive("/about-us")
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  About Us
                </Link>
                <Link
                  href="/pricing"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive("/pricing")
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Pricing
                </Link>
                <Link
                  href="/contact-us"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive("/contact-us")
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Contact
                </Link>

                <div className="flex items-center space-x-3">
                  <Link
                    href="/login"
                    className="flex items-center space-x-2 text-white/80 hover:text-white px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors duration-200"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="text-sm font-medium">Login</span>
                  </Link>
                  <Link
                    href="/register"
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 backdrop-blur-sm border border-white/20"
                  >
                    Get Started
                  </Link>
                </div>
              </>
            ) : null}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white/80 hover:text-white p-2"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-1 pt-2 pb-3 space-y-1 bg-black/95 backdrop-blur-md rounded-lg mt-2 border border-white/10">
              <LoadingLink
                href="/"
                loadingKey="nav-home-mobile"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive("/") || isActive("/home")
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
                onClick={() => setIsMenuOpen(false)}
                router={router}
              >
                Home
              </LoadingLink>

              {user && session ? (
                <>
                  <LoadingLink
                    href="/organizations"
                    loadingKey="nav-organizations-mobile"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/organizations")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                    router={router}
                  >
                    Organizations
                  </LoadingLink>
                  <LoadingLink
                    href="/pricing"
                    loadingKey="nav-pricing-mobile"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/pricing")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                    router={router}
                  >
                    Pricing
                  </LoadingLink>
                  <LoadingLink
                    href="/chat"
                    loadingKey="nav-chat-mobile"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/chat")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                    router={router}
                  >
                    Chat
                  </LoadingLink>
                  <LoadingLink
                    href="/profile"
                    loadingKey="nav-profile-mobile"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/profile")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                    router={router}
                  >
                    Profile
                  </LoadingLink>
                  <LoadingButton
                    onClick={signOut}
                    loadingKey="nav-signout-mobile"
                    variant="ghost"
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-white/10"
                  >
                    Sign Out
                  </LoadingButton>
                </>
              ) : (
                <>
                  <LoadingLink
                    href="/about-us"
                    loadingKey="nav-about-mobile"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/about-us")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                    router={router}
                  >
                    About Us
                  </LoadingLink>
                  <LoadingLink
                    href="/pricing"
                    loadingKey="nav-pricing-mobile-guest"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/pricing")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                    router={router}
                  >
                    Pricing
                  </LoadingLink>
                  <Link
                    href="/contact-us"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/contact-us")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Contact
                  </Link>
                  <Link
                    href="/login"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/login")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/register")
                        ? "text-white bg-gradient-to-r from-blue-600 to-blue-700"
                        : "text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navigation;
