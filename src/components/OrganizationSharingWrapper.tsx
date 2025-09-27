"use client";

import React from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import OrganizationSharing from "./OrganizationSharing";

interface OrganizationSharingWrapperProps {
  organizationId: string;
  organizationName: string;
  userRole: "owner" | "member" | "viewer";
  onClose: () => void;
}

const OrganizationSharingWrapper: React.FC<OrganizationSharingWrapperProps> = (
  props
) => {
  // This wrapper ensures the context is available before rendering the component
  const authContext = useSupabaseAuth();

  // If context is not available, show a loading state
  if (!authContext) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading authentication...</span>
          </div>
        </div>
      </div>
    );
  }

  return <OrganizationSharing {...props} />;
};

export default OrganizationSharingWrapper;
