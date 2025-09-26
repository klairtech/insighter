"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

const ClientHome: React.FC = () => {
  const { user } = useSupabaseAuth();
  const isAuthenticated = !!user;

  // Live analytics demo state
  const [currentInsight, setCurrentInsight] = useState(0);
  const [isLive] = useState(true);

  const liveInsights = [
    {
      text: "Q4 sales up 23% - Customer segment A driving growth",
      metrics: ["+23%", "Q4", "↑"],
      colors: ["bg-blue-500", "bg-blue-500", "bg-purple-500"],
    },
    {
      text: "User engagement increased 45% this month",
      metrics: ["+45%", "Monthly", "↑"],
      colors: ["bg-green-500", "bg-blue-500", "bg-green-500"],
    },
    {
      text: "Conversion rate improved by 12% after UI update",
      metrics: ["+12%", "Conversion", "↑"],
      colors: ["bg-purple-500", "bg-green-500", "bg-blue-500"],
    },
  ];

  // Rotate insights every 3 seconds
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setCurrentInsight((prev) => (prev + 1) % liveInsights.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isLive, liveInsights.length]);

  // FAQ state management
  const [searchTerm, setSearchTerm] = useState("");
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqs = [
    {
      question: "What is Insighter?",
      answer:
        "Insighter is an AI-powered data analysis platform that transforms complex data into actionable insights through natural language conversations. It connects to your data sources and allows you to ask questions in plain English to get instant, intelligent responses.",
    },
    {
      question: "How does Insighter help non-technical users?",
      answer:
        "Insighter eliminates the need for SQL knowledge or technical expertise. Simply ask questions in natural language like 'What are our top-selling products this month?' and get instant insights with visualizations. Our AI understands business context and provides relevant answers.",
    },
    {
      question: "What types of data sources can Insighter connect to?",
      answer:
        "Insighter supports 50+ data sources including databases (MySQL, PostgreSQL, SQL Server), cloud platforms (AWS, Google Cloud, Azure), file formats (CSV, Excel, JSON), APIs, and business applications (Salesforce, HubSpot, etc.).",
    },
    {
      question: "How secure is my data on Insighter?",
      answer:
        "We are fully compliant with GDPR and HIPAA regulations, featuring enterprise-grade security with AES-256-CBC encryption, multi-factor authentication, comprehensive audit trails, and automated breach notification systems. Your data is encrypted in transit and at rest, and you have complete control over your data with full data subject rights.",
    },
    {
      question: "Can I integrate Insighter with other applications?",
      answer:
        "Yes! Insighter offers robust API integrations and can connect with popular business tools like Slack, Microsoft Teams, Google Workspace, and more. You can also export insights to PowerPoint, PDF, or share live dashboards.",
    },
    {
      question: "Does Insighter support real-time data updates?",
      answer:
        "Absolutely! Insighter can connect to live data sources and provide real-time insights. You can set up automated reports and get notified when key metrics change, ensuring you always have the latest information.",
    },
    {
      question: "What kind of support does Insighter offer?",
      answer:
        "We provide 24/7 customer support, comprehensive documentation, video tutorials, and dedicated onboarding assistance. Our team helps you get started in under 2 minutes and provides ongoing support throughout your journey.",
    },
    {
      question: "How much does Insighter cost?",
      answer:
        "We're currently offering a free pilot program with no credit card required. This includes full access to all features, data connections, and support. After the pilot, we offer flexible pricing plans based on your data volume and team size.",
    },
  ];

  const filteredFAQs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section with Live Analytics Demo */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Main Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
                <span className="text-blue-400 text-sm font-medium">
                  LIVE DEMO
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Transform Data Into
                <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
                  Intelligent Insights
                </span>
              </h1>

              <p className="text-xl text-gray-300 mb-8 max-w-2xl">
                Ask questions in plain English and get instant, AI-powered
                insights from your data. No SQL knowledge required - just
                natural language conversations.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {isAuthenticated ? (
                  <Link
                    href="/organizations"
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                  >
                    Go to Dashboard
                    <svg
                      className="ml-2 w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/register"
                      className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                    >
                      Start Free Trial
                      <svg
                        className="ml-2 w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </Link>
                    <Link
                      href="/contact-us"
                      className="inline-flex items-center px-8 py-4 border border-gray-600 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all duration-300"
                    >
                      Contact Sales
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Right Column - Live Analytics Demo */}
            <div className="relative">
              <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 shadow-2xl">
                {/* Demo Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-xl flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        Insighter AI
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Advanced LLM-Powered Analytics
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-medium">
                      LIVE
                    </span>
                  </div>
                </div>

                {/* Live Analysis Section */}
                <div className="mb-6">
                  <div className="flex items-center mb-4">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                    <span className="text-blue-400 text-sm font-medium uppercase tracking-wide">
                      LIVE ANALYSIS
                    </span>
                  </div>

                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="text-gray-400 text-xs mb-2">
                      AI INSIGHT:
                    </div>
                    <div className="text-white text-lg font-medium">
                      &ldquo;{liveInsights[currentInsight].text}&rdquo;
                    </div>
                  </div>

                  <div className="flex space-x-3 mt-4">
                    {liveInsights[currentInsight].metrics.map(
                      (metric, index) => (
                        <div
                          key={index}
                          className={`px-4 py-2 rounded-lg text-white font-semibold ${liveInsights[currentInsight].colors[index]} transition-all duration-500`}
                        >
                          {metric}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-6">
                  {["AI Response", "SQL Generation", "Chart Generation"].map(
                    (feature, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <span className="text-white text-sm">{feature}</span>
                      </div>
                    )
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {["Real-time Analysis", "ML Insights", "SQL Generation"].map(
                    (tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 border border-gray-600 rounded-full text-gray-300 text-xs hover:border-blue-400 hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>

                {/* CTA */}
                <div className="text-center">
                  <div className="text-gray-400 text-xs mb-2">TRY IT IN</div>
                  <Link
                    href="/canvas"
                    className="inline-flex items-center text-white font-semibold hover:text-blue-400 transition-colors"
                  >
                    Try Insighter Demo
                    <svg
                      className="ml-1 w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Powerful Features for Modern Analytics
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Everything you need to unlock the full potential of your data
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                Natural Language Queries
              </h3>
              <p className="text-gray-300">
                Ask questions in plain English. No need to learn SQL or complex
                query languages.
              </p>
            </div>

            <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                AI-Powered Analysis
              </h3>
              <p className="text-gray-300">
                Advanced AI algorithms understand context and provide
                intelligent, relevant insights.
              </p>
            </div>

            <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                Auto-Generated Visualizations
              </h3>
              <p className="text-gray-300">
                Get beautiful charts and graphs automatically generated from
                your data queries.
              </p>
            </div>

            <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                Universal Data Connectivity
              </h3>
              <p className="text-gray-300">
                Connect to 50+ data sources including databases, files, APIs,
                and cloud platforms.
              </p>
            </div>

            <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                Enterprise Security
              </h3>
              <p className="text-gray-300">
                GDPR and HIPAA compliant with end-to-end encryption and
                comprehensive audit trails.
              </p>
            </div>

            <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">
                Team Collaboration
              </h3>
              <p className="text-gray-300">
                Share insights, collaborate on analysis, and work together on
                data-driven decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-300">
              Everything you need to know about Insighter
            </p>
          </div>

          <div className="mb-8">
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
            />
          </div>

          <div className="space-y-4">
            {filteredFAQs.map((faq, index) => (
              <div
                key={index}
                className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden"
              >
                <button
                  className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-800/50 transition-colors"
                  onClick={() => toggleFAQ(index)}
                >
                  <span className="font-semibold text-white">
                    {faq.question}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      openFAQ === index ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {openFAQ === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-300 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-gray-700 rounded-2xl p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your Data?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of users who are already making data-driven
              decisions with Insighter.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Link
                  href="/organizations"
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                >
                  Go to Dashboard
                  <svg
                    className="ml-2 w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                  >
                    Start Free Trial
                    <svg
                      className="ml-2 w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </Link>
                  <Link
                    href="/contact-us"
                    className="inline-flex items-center px-8 py-4 border border-gray-600 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all duration-300"
                  >
                    Contact Sales
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ClientHome;
