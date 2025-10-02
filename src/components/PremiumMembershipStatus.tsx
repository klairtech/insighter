import React from "react";
import { usePremiumMembership } from "@/hooks/usePremiumMembership";

interface PremiumMembershipStatusProps {
  className?: string;
}

const PremiumMembershipStatus: React.FC<PremiumMembershipStatusProps> = ({
  className = "",
}) => {
  const {
    membership,
    isLoading,
    error,
    isPremium,
    membershipExpiry,
    daysUntilExpiry,
  } = usePremiumMembership();

  if (isLoading) {
    return (
      <div
        className={`bg-gray-800 border border-gray-700 rounded-lg p-6 ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-gray-800 border border-red-500 rounded-lg p-6 ${className}`}
      >
        <div className="flex items-center">
          <div className="text-red-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-300">
              Error loading membership
            </h3>
            <p className="text-sm text-red-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isPremium || !membership) {
    return null;
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = () => {
    if (daysUntilExpiry === null) return "text-gray-400";
    if (daysUntilExpiry <= 7) return "text-red-400";
    if (daysUntilExpiry <= 30) return "text-yellow-400";
    return "text-green-400";
  };

  const getStatusText = () => {
    if (daysUntilExpiry === null) return "Active";
    if (daysUntilExpiry <= 0) return "Expired";
    if (daysUntilExpiry === 1) return "Expires tomorrow";
    if (daysUntilExpiry <= 7) return `Expires in ${daysUntilExpiry} days`;
    if (daysUntilExpiry <= 30) return `Expires in ${daysUntilExpiry} days`;
    return "Active";
  };

  return (
    <div
      className={`bg-gray-800 border border-gray-700 rounded-lg p-6 ${className}`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-white">
            Premium Membership Active
          </h3>
          <div className="mt-2 space-y-1">
            <p className="text-sm text-gray-300">
              <span className="font-medium">Plan:</span> Premium{" "}
              {membership.is_annual ? "Annual" : "Monthly"}
            </p>
            <p className="text-sm text-gray-300">
              <span className="font-medium">Credits:</span>{" "}
              {membership.monthly_credits.toLocaleString()} per month
            </p>
            <p className="text-sm text-gray-300">
              <span className="font-medium">Status:</span>
              <span className={`ml-1 font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </p>
            {membershipExpiry && (
              <p className="text-sm text-gray-300">
                <span className="font-medium">Expires:</span>{" "}
                {formatDate(membershipExpiry)}
              </p>
            )}
          </div>

          {/* Upgrade to Annual Message */}
          {!membership.is_annual && (
            <div className="mt-4">
              <div className="bg-green-900/20 rounded-md p-3 border border-green-500/30">
                <p className="text-sm text-green-300">
                  💰 <strong>Save 20%</strong> by upgrading to Annual Premium!
                  Your new billing cycle will start after your current monthly
                  plan expires.
                </p>
              </div>
            </div>
          )}

          {/* Annual Member Message */}
          {membership.is_annual && (
            <div className="mt-4">
              <div className="bg-blue-900/20 rounded-md p-3 border border-blue-500/30">
                <p className="text-sm text-blue-300">
                  🎉 <strong>Annual Premium Active!</strong> You&apos;re saving
                  20% with your annual plan. You can renew early or purchase
                  additional flexible credits anytime.
                </p>
              </div>
            </div>
          )}

          {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
            <div className="mt-4">
              <div className="bg-gray-700 rounded-md p-3 border border-gray-600">
                <p className="text-sm text-gray-200">
                  {daysUntilExpiry <= 0
                    ? "Your premium membership has expired. Renew to continue enjoying premium features."
                    : daysUntilExpiry <= 7
                    ? "Your premium membership expires soon. Consider renewing to avoid interruption."
                    : "Your premium membership will expire soon. You can renew anytime."}
                </p>
                {!membership.is_annual && (
                  <p className="text-sm text-blue-300 mt-2 font-medium">
                    💡 Upgrade to Annual and save 20% on your next billing
                    cycle!
                  </p>
                )}
                {membership.is_annual && (
                  <p className="text-sm text-blue-300 mt-2 font-medium">
                    💡 You can renew early or purchase additional flexible
                    credits to extend your benefits!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumMembershipStatus;
