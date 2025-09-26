"use client";

import React, { useState } from "react";
import Link from "next/link";

const PricingPage: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      name: "Starter",
      description: "Perfect for individuals and small teams",
      monthlyPrice: 29,
      annualPrice: 290,
      features: [
        "Up to 5 data connections",
        "10,000 queries per month",
        "Basic AI insights",
        "Email support",
        "Standard data sources",
        "1 workspace",
        "Basic visualizations",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Professional",
      description: "Ideal for growing businesses",
      monthlyPrice: 99,
      annualPrice: 990,
      features: [
        "Up to 25 data connections",
        "100,000 queries per month",
        "Advanced AI insights",
        "Priority support",
        "All data sources",
        "5 workspaces",
        "Advanced visualizations",
        "Team collaboration",
        "API access",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      description: "For large organizations",
      monthlyPrice: 299,
      annualPrice: 2990,
      features: [
        "Unlimited data connections",
        "Unlimited queries",
        "Custom AI models",
        "24/7 dedicated support",
        "All data sources + custom",
        "Unlimited workspaces",
        "Custom visualizations",
        "Advanced team management",
        "Full API access",
        "On-premise deployment",
        "Custom integrations",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Choose the plan that&apos;s right for your team. All plans include
              a 14-day free trial with no credit card required.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center mb-8">
              <span
                className={`text-sm font-medium ${
                  !isAnnual ? "text-white" : "text-gray-400"
                }`}
              >
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="mx-3 relative inline-flex h-6 w-11 items-center rounded-full bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAnnual ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-sm font-medium ${
                  isAnnual ? "text-white" : "text-gray-400"
                }`}
              >
                Annual
              </span>
              {isAnnual && (
                <span className="ml-2 text-sm text-green-400 font-medium">
                  Save 17%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative klair-card p-8 ${
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

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-400 mb-6">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">
                    ${isAnnual ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-gray-400">
                    /{isAnnual ? "year" : "month"}
                  </span>
                </div>
                <Link
                  href={
                    plan.cta === "Contact Sales" ? "/contact-us" : "/register"
                  }
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                    plan.popular
                      ? "klair-button-primary"
                      : "klair-button-secondary"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>

              <ul className="space-y-4">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0"
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
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gradient-to-br from-blue-500/5 to-blue-600/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-300">
              Everything you need to know about our pricing
            </p>
          </div>

          <div className="space-y-8">
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
                What happens if I exceed my query limit?
              </h3>
              <p className="text-gray-400">
                We&apos;ll notify you when you&apos;re approaching your limit.
                You can upgrade your plan or purchase additional queries as
                needed.
              </p>
            </div>

            <div className="klair-card p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-400">
                Yes, all plans include a 14-day free trial with full access to
                all features. No credit card required to start.
              </p>
            </div>

            <div className="klair-card p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-400">
                We accept all major credit cards, PayPal, and bank transfers for
                Enterprise customers.
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of users who are already making data-driven
              decisions with Insighter.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="klair-button-primary text-lg px-8 py-4"
              >
                Start Free Trial
              </Link>
              <Link
                href="/contact-us"
                className="klair-button-secondary text-lg px-8 py-4"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
