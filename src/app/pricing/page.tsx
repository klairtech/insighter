"use client";

import React, { useState } from "react";
import Link from "next/link";
import CreditPurchaseModal from "@/components/CreditPurchaseModal";
import PremiumMembershipStatus from "@/components/PremiumMembershipStatus";
import PaymentSuccessModal from "@/components/PaymentSuccessModal";
import { usePremiumMembership } from "@/hooks/usePremiumMembership";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  getPremiumPlanPricing,
  type SupportedCurrency,
} from "@/lib/pricing-utils";

const PricingPage: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState(true); // Annual as default
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] =
    useState<SupportedCurrency>("INR");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    planName: string;
    credits: number;
    isAnnual: boolean;
  } | null>(null);

  const {
    isPremium,
    membership,
    isLoading: membershipLoading,
    error: membershipError,
  } = usePremiumMembership();

  const {
    trackViewPricing,
    trackStartSubscription,
    trackPurchaseSubscription,
  } = useAnalytics();

  // Track pricing page view
  React.useEffect(() => {
    trackViewPricing();
  }, [trackViewPricing]);

  // Get Premium plan pricing in selected currency
  const premiumPricing = getPremiumPlanPricing(selectedCurrency);

  const plans = [
    {
      name: "Free",
      description: "Perfect for getting started with data analysis",
      monthlyPrice: 0,
      annualPrice: 0,
      credits: 100,
      features: [
        "100 credits per month",
        "Community support",
        "Standard processing speed",
      ],
      cta: "Get Started Free",
      popular: false,
    },
    {
      name: "Flexible",
      description: "Pay only for what you use",
      monthlyPrice: null,
      annualPrice: null,
      credits: "Pay-as-you-go",
      features: [
        "Buy credits in multiples of 100",
        "5% bonus credits per 100 credits",
        "100 credits = $1.19 or ₹99",
        "No monthly commitment",
      ],
      cta: "Buy Credits",
      popular: false,
    },
    {
      name: "Premium",
      description: "For advanced analytics and large teams",
      monthlyPrice: premiumPricing.monthly,
      annualPrice: premiumPricing.annual,
      credits: 2500,
      features: [
        "2,500 credits per month",
        "Priority support",
        "Fastest processing speed",
        "20% discount on annual billing",
      ],
      cta: "Subscribe",
      popular: true,
    },
    {
      name: "Enterprise",
      description: "For large organizations with custom needs",
      monthlyPrice: null,
      annualPrice: null,
      credits: "Unlimited",
      features: [
        "Unlimited credits",
        "24/7 dedicated support",
        "SLA guarantee",
        "Custom integrations",
        "On-premise deployment",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  const handleCreditPurchase = async (credits: number) => {
    // Track credit purchase
    trackPurchaseSubscription(
      "credits",
      credits * 0.01,
      `credit_purchase_${credits}`
    );

    // This function is called after successful payment processing
    // The actual payment was already processed by CreditPurchaseModal
    // We just need to redirect to a success page or dashboard
    try {
      // Wait a moment to let users see the success message
      setTimeout(() => {
        // Close the credit modal
        setIsCreditModalOpen(false);

        // Redirect to dashboard or profile page to show updated credits
        window.location.href = "/profile";
      }, 2000); // 2 second delay
    } catch (error) {
      console.error("Redirect error:", error);
      // Fallback: just close the modal
      setIsCreditModalOpen(false);
    }
  };

  const handlePremiumPurchase = async (plan: { name: string; cta: string }) => {
    try {
      // Track subscription start
      const planPrice = isAnnual
        ? premiumPricing.annual
        : premiumPricing.monthly;
      trackStartSubscription(plan.name.toLowerCase(), planPrice);

      // Create order for Premium plan
      const orderResponse = await fetch("/api/credits/create-premium-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planType: plan.name.toLowerCase(),
          isAnnual: isAnnual,
        }),
      });

      const orderData = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // Load Razorpay script
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        // Note: CORS errors from browser.sentry-cdn.com are from Razorpay's internal error tracking
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: "Insighter",
          description: `${plan.name} Plan - ${orderData.credits} credits`,
          image:
            "https://uvbtwtqmtsbdwmcrtdcx.supabase.co/storage/v1/object/public/website/public/Logos/Insighter/Insighter%20Logos%20(svg)/logo.svg",
          order_id: orderData.order.id,
          handler: async function (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) {
            try {
              // Verify payment and complete purchase
              const purchaseResponse = await fetch(
                "/api/credits/purchase-premium",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    planType: plan.name.toLowerCase(),
                    isAnnual: isAnnual,
                    credits: orderData.credits,
                    amount_paid: orderData.order.amount,
                  }),
                }
              );

              let purchaseData;
              try {
                purchaseData = await purchaseResponse.json();
              } catch (jsonError) {
                console.error("❌ Failed to parse response JSON:", jsonError);
                const responseText = await purchaseResponse.text();
                console.error("❌ Raw response:", responseText);
                purchaseData = {
                  error: "Invalid response from server",
                  rawResponse: responseText,
                };
              }


              if (!purchaseResponse.ok) {
                console.error("❌ Purchase failed:", purchaseData);
                throw new Error(
                  purchaseData.error ||
                    `Purchase failed with status ${purchaseResponse.status}`
                );
              }

              // Show success modal instead of alert
              setSuccessData({
                planName: plan.name,
                credits: orderData.credits,
                isAnnual: isAnnual,
              });
              setShowSuccessModal(true);
            } catch (error) {
              console.error("Payment verification failed:", error);
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred";
              alert(
                `Payment verification failed: ${errorMessage}. Please check the console for more details and contact support if the issue persists.`
              );
            }
          },
          prefill: {
            name: "User",
            email: "user@example.com",
          },
          theme: {
            color: "#3B82F6",
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      };
      document.body.appendChild(script);
    } catch (error) {
      console.error("Premium purchase error:", error);
      alert("Purchase failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 md:mb-4">
              Simple, Fair Pricing
            </h1>
            <p className="text-sm md:text-base lg:text-lg text-gray-300 max-w-2xl mx-auto mb-4 md:mb-6">
              All features for everyone. Pay only for what you use. Start with
              100 free credits every month.
            </p>

            {/* What's Included Section */}
            <div className="bg-gray-800/50 rounded-lg p-4 md:p-6 mb-4 md:mb-6 max-w-4xl mx-auto">
              <h3 className="text-sm md:text-base font-semibold text-white mb-2 md:mb-3 text-center">
                What&apos;s Included in All Plans:
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm text-gray-300">
                <div className="flex items-center">
                  <svg
                    className="w-3 h-3 md:w-4 md:h-4 text-green-400 mr-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Unlimited DB connections
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-3 h-3 md:w-4 md:h-4 text-green-400 mr-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Unlimited workspaces
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-3 h-3 md:w-4 md:h-4 text-green-400 mr-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Unlimited AI agents
                </div>
                <div className="flex items-center">
                  <svg
                    className="w-3 h-3 md:w-4 md:h-4 text-green-400 mr-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Advanced analytics
                </div>
              </div>
            </div>

            {/* Currency Selector */}
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">Currency:</span>
                <select
                  value={selectedCurrency}
                  onChange={(e) =>
                    setSelectedCurrency(e.target.value as SupportedCurrency)
                  }
                  className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                  <option value="GBP">£ GBP</option>
                </select>
              </div>
            </div>

            {/* Billing Toggle - Compact */}
            <div className="flex items-center justify-center mb-4 md:mb-6">
              <span
                className={`text-xs md:text-sm font-medium ${
                  !isAnnual ? "text-white" : "text-gray-400"
                }`}
              >
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="mx-2 md:mx-3 relative inline-flex h-5 w-9 md:h-6 md:w-11 items-center rounded-full bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
              >
                <span
                  className={`inline-block h-3 w-3 md:h-4 md:w-4 transform rounded-full bg-white transition-transform ${
                    isAnnual
                      ? "translate-x-5 md:translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-xs md:text-sm font-medium ${
                  isAnnual ? "text-white" : "text-gray-400"
                }`}
              >
                Annual
              </span>
              {isAnnual && (
                <span className="ml-1 md:ml-2 text-xs md:text-sm text-green-400 font-medium">
                  Save 20%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Premium Membership Status */}
      {!membershipLoading && isPremium && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <PremiumMembershipStatus />
        </div>
      )}

      {/* Membership Error Display */}
      {membershipError && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-400 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-red-300 font-medium">
                Membership Status Error
              </h3>
            </div>
            <p className="text-red-200 text-sm mt-2">
              Unable to load membership information: {membershipError}
            </p>
            <p className="text-red-200 text-sm mt-1">
              You can still purchase plans, but some features may not work
              correctly.
            </p>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative klair-card p-4 md:p-6 lg:p-8 flex flex-col h-full min-h-[500px] ${
                plan.popular ? "ring-2 ring-blue-500" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-4 md:mb-6">
                <h3 className="text-lg md:text-xl font-bold text-white mb-1 md:mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-400 text-xs md:text-sm mb-3 md:mb-4">
                  {plan.description}
                </p>
                <div className="mb-3 md:mb-4">
                  <div className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">
                    {typeof plan.credits === "number"
                      ? plan.credits.toLocaleString()
                      : plan.credits}
                  </div>
                  <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">
                    credits/month
                  </div>
                  {plan.monthlyPrice !== null && (
                    <div className="text-base md:text-lg text-gray-300">
                      {isAnnual ? (
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-2xl md:text-3xl font-bold text-white">
                              {premiumPricing.symbol}
                              {(plan.annualPrice / 12).toFixed(2)}
                            </span>
                            <span className="text-sm md:text-base text-gray-400">
                              /month
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 line-through">
                            {premiumPricing.symbol}
                            {plan.annualPrice}/year
                          </div>
                          <div className="text-xs text-green-400 font-medium">
                            Save {premiumPricing.symbol}
                            {(
                              plan.monthlyPrice * 12 -
                              plan.annualPrice
                            ).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-2xl md:text-3xl font-bold text-white">
                            {premiumPricing.symbol}
                            {plan.monthlyPrice}
                          </span>
                          <span className="text-sm md:text-base text-gray-400">
                            /month
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {plan.monthlyPrice === null && (
                    <div className="text-base md:text-lg text-gray-300">
                      Custom pricing
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-grow flex flex-col justify-between">
                <ul className="space-y-2 md:space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <svg
                        className="w-4 h-4 md:w-5 md:h-5 text-green-400 mr-2 md:mr-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-300 text-xs md:text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {plan.cta === "Buy Credits" ? (
                    <button
                      onClick={() => setIsCreditModalOpen(true)}
                      className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 text-sm md:text-base min-h-[48px] flex items-center justify-center ${
                        plan.popular
                          ? "klair-button-primary"
                          : "klair-button-secondary"
                      }`}
                    >
                      {plan.cta}
                    </button>
                  ) : plan.cta === "Subscribe" ? (
                    <button
                      onClick={() => {
                        // Handle all edge cases for premium purchases
                        if (!isPremium || !membership) {
                          // Free users or users with membership errors
                          handlePremiumPurchase(plan);
                        } else if (
                          membership.plan_type === "premium" &&
                          !membership.is_annual &&
                          isAnnual
                        ) {
                          // Monthly premium users upgrading to annual
                          handlePremiumPurchase(plan);
                        } else if (
                          membership.plan_type === "premium" &&
                          membership.is_annual
                        ) {
                          // Annual premium users can renew early
                          handlePremiumPurchase(plan);
                        } else if (membership.plan_type !== "premium") {
                          // Enterprise or other plan users
                          handlePremiumPurchase(plan);
                        }
                        // Monthly premium users selecting monthly are blocked (handled by disabled state)
                      }}
                      disabled={
                        isPremium &&
                        membership?.plan_type === "premium" &&
                        !membership?.is_annual &&
                        !isAnnual
                      }
                      className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 text-sm md:text-base min-h-[48px] flex items-center justify-center ${
                        isPremium &&
                        membership?.plan_type === "premium" &&
                        !membership?.is_annual &&
                        !isAnnual
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : plan.popular
                          ? "klair-button-primary"
                          : "klair-button-secondary"
                      }`}
                    >
                      {isPremium && membership
                        ? membership.plan_type === "premium" &&
                          !membership.is_annual &&
                          isAnnual
                          ? "Upgrade to Annual"
                          : membership.plan_type === "premium" &&
                            membership.is_annual
                          ? "Renew Early"
                          : membership.plan_type === "premium" &&
                            !membership.is_annual &&
                            !isAnnual
                          ? "Already Premium"
                          : membership.plan_type !== "premium"
                          ? plan.cta
                          : "Already Premium"
                        : plan.cta}
                    </button>
                  ) : (
                    <Link
                      href={
                        plan.cta === "Contact Sales"
                          ? "/contact-us"
                          : "/register"
                      }
                      className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 text-sm md:text-base min-h-[48px] flex items-center justify-center ${
                        plan.popular
                          ? "klair-button-primary"
                          : "klair-button-secondary"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gradient-to-br from-blue-500/5 to-blue-600/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="text-center mb-6 md:mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-gray-300">
              Everything you need to know about our pricing
            </p>
          </div>

          <div className="space-y-4 md:space-y-6">
            <div className="klair-card p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I change my plan at any time?
              </h3>
              <p className="text-gray-400">
                Yes, you can upgrade or downgrade your plan at any time. Changes
                will be reflected in your next billing cycle.
              </p>
            </div>

            <div className="klair-card p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What happens if I run out of credits?
              </h3>
              <p className="text-gray-400">
                We&apos;ll notify you when you&apos;re running low on credits.
                You can upgrade your plan or purchase additional credits as
                needed. Credits reset monthly.
              </p>
            </div>

            <div className="klair-card p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                How do credits work?
              </h3>
              <p className="text-gray-400">
                Credits are consumed based on operation complexity. Simple
                queries use 1-2 credits, while complex analytics and
                visualizations may use 5-10 credits. You get 100 free credits
                every month.
              </p>
            </div>

            <div className="klair-card p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-400">
                We accept all major credit cards, UPI, and bank transfers for
                Enterprise customers. All payments are processed securely
                through Razorpay.
              </p>
            </div>

            <div className="klair-card p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-400">
                Yes, you can cancel your subscription at any time. You&apos;ll
                continue to have access until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-gray-300 mb-4 md:mb-6">
              Join thousands of users who are already making data-driven
              decisions with Insighter. All features included, pay only for
              usage.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
              <Link
                href="/register"
                className="klair-button-primary text-sm md:text-base lg:text-lg px-6 md:px-8 py-3 md:py-4"
              >
                Get Started Free
              </Link>
              <Link
                href="/contact-us"
                className="klair-button-secondary text-sm md:text-base lg:text-lg px-6 md:px-8 py-3 md:py-4"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        onPurchase={handleCreditPurchase}
      />

      {/* Payment Success Modal */}
      {successData && (
        <PaymentSuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setSuccessData(null);
          }}
          planName={successData.planName}
          credits={successData.credits}
          isAnnual={successData.isAnnual}
        />
      )}
    </div>
  );
};

export default PricingPage;
