"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

const ClientHome: React.FC = () => {
  const authContext = useSupabaseAuth();
  const { user } = authContext || { user: null };
  const [isClient, setIsClient] = useState(false);
  const isAuthenticated = !!user;

  // Handle hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

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
        "Insighter eliminates the need for SQL knowledge or technical expertise. Simply ask questions in natural language like &apos;What are our top-selling products this month?&apos; and get instant insights with visualizations. Our AI understands business context and provides relevant answers.",
    },
    {
      question: "What types of data sources can Insighter connect to?",
      answer:
        "Insighter supports 50+ data sources including databases (MySQL, PostgreSQL, SQL Server), cloud platforms (AWS, Google Cloud, Azure), file formats (CSV, Excel, JSON), APIs, and business applications (Salesforce, HubSpot, etc.).",
    },
    {
      question: "How secure is my data on Insighter?",
      answer:
        "Insighter is end-to-end encrypted with military-grade AES-256 encryption. We implement zero-knowledge architecture, meaning we cannot see your data - only you have the decryption keys. We use enterprise-grade security with 24/7 monitoring, multi-factor authentication, and comprehensive audit trails. Your data security is our absolute top priority.",
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
        "We&apos;re currently offering a free pilot program with no credit card required. This includes full access to all features, data connections, and support. After the pilot, we offer flexible pricing plans based on your data volume and team size.",
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
    <div className="min-h-screen bg-background">
      {/* Hero Section with Live Analytics Demo */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Main Content */}
            <div className="text-center lg:text-left">
              <div className="flex flex-wrap gap-3 mb-6 justify-center lg:justify-start">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
                  <span className="text-blue-400 text-sm font-medium">
                    LIVE DEMO
                  </span>
                </div>
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                  <svg
                    className="w-4 h-4 text-green-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span className="text-green-400 text-sm font-medium">
                    END-TO-END ENCRYPTED
                  </span>
                </div>
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
                {!isClient ? (
                  // Show default content during SSR to prevent hydration mismatch
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
                ) : isAuthenticated ? (
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

      {/* Security & Encryption Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-blue-500/5 to-purple-500/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-500/3 via-transparent to-transparent"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
              <span className="text-green-400 text-sm font-medium">
                ENTERPRISE SECURITY
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              <span className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                End-to-End Encrypted
              </span>
              <br />
              Data Security is Our Top Priority
            </h2>

            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Your data is protected with military-grade encryption,
              zero-knowledge architecture, and enterprise-grade security
              measures that ensure complete privacy and security.
            </p>
          </div>

          {/* Security Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {/* Encryption Badge */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-green-500/50 transition-all duration-500 group-hover:scale-105">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                  <svg
                    className="w-8 h-8 text-white"
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
                <h3 className="text-xl font-bold text-white mb-4">
                  AES-256 Encryption
                </h3>
                <p className="text-gray-300">
                  Military-grade encryption protects your data both in transit
                  and at rest, ensuring complete confidentiality.
                </p>
                <div className="mt-4 flex items-center text-green-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                  <span>Always Encrypted</span>
                </div>
              </div>
            </div>

            {/* Zero Knowledge */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-500 group-hover:scale-105">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">
                  Zero-Knowledge Architecture
                </h3>
                <p className="text-gray-300">
                  We can&apos;t see your data. Only you have the keys to decrypt
                  and access your sensitive information.
                </p>
                <div className="mt-4 flex items-center text-blue-400 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
                  <span>Complete Privacy</span>
                </div>
              </div>
            </div>

            {/* Security & Privacy */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-emerald-500/50 transition-all duration-500 group-hover:scale-105">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
                  <svg
                    className="w-8 h-8 text-white"
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
                <h3 className="text-xl font-bold text-white mb-4">
                  Secure by Design
                </h3>
                <p className="text-gray-300">
                  End-to-end encryption, secure authentication, and
                  privacy-focused architecture built for enterprise security.
                </p>
                <div className="mt-4 flex items-center text-emerald-400 text-sm">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse mr-2"></div>
                  <span>Enterprise Security</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Animation Section */}
          <div className="relative bg-gray-900/30 backdrop-blur-sm border border-gray-700 rounded-3xl p-8 md:p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-blue-500/5 to-purple-500/5"></div>

            <div className="relative grid lg:grid-cols-2 gap-12 items-center">
              {/* Left - Security Stats */}
              <div>
                <h3 className="text-3xl font-bold text-white mb-6">
                  Security That Never Sleeps
                </h3>
                <p className="text-gray-300 mb-8">
                  Our multi-layered security approach ensures your data is
                  protected around the clock with real-time monitoring and
                  automated threat detection.
                </p>

                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
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
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        99.99%
                      </div>
                      <div className="text-gray-400">Uptime Guarantee</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
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
                    <div>
                      <div className="text-2xl font-bold text-white">
                        256-bit
                      </div>
                      <div className="text-gray-400">AES Encryption</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center">
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
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">24/7</div>
                      <div className="text-gray-400">Security Monitoring</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - Animated Security Visualization */}
              <div className="relative">
                <div className="relative w-full h-80 bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
                  {/* Animated Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-blue-500/10 to-purple-500/10"></div>

                  {/* Central Shield */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center animate-pulse">
                      <svg
                        className="w-12 h-12 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Orbiting Security Elements */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div
                      className="w-80 h-80 border border-green-500/20 rounded-full animate-spin"
                      style={{ animationDuration: "20s" }}
                    >
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-400 rounded-full"></div>
                    </div>
                    <div
                      className="w-64 h-64 border border-blue-500/20 rounded-full animate-spin"
                      style={{
                        animationDuration: "15s",
                        animationDirection: "reverse",
                      }}
                    >
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full"></div>
                    </div>
                    <div
                      className="w-48 h-48 border border-purple-500/20 rounded-full animate-spin"
                      style={{ animationDuration: "10s" }}
                    >
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-purple-400 rounded-full"></div>
                    </div>
                  </div>

                  {/* Floating Security Icons */}
                  <div
                    className="absolute top-8 left-8 w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center animate-bounce"
                    style={{ animationDelay: "0s" }}
                  >
                    <svg
                      className="w-4 h-4 text-green-400"
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

                  <div
                    className="absolute top-8 right-8 w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center animate-bounce"
                    style={{ animationDelay: "1s" }}
                  >
                    <svg
                      className="w-4 h-4 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>

                  <div
                    className="absolute bottom-8 left-8 w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center animate-bounce"
                    style={{ animationDelay: "2s" }}
                  >
                    <svg
                      className="w-4 h-4 text-purple-400"
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

                  <div
                    className="absolute bottom-8 right-8 w-8 h-8 bg-pink-500/20 rounded-lg flex items-center justify-center animate-bounce"
                    style={{ animationDelay: "3s" }}
                  >
                    <svg
                      className="w-4 h-4 text-pink-400"
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
                </div>

                {/* Security Status */}
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                    <span className="text-green-400 text-sm font-medium">
                      ALL SYSTEMS SECURE
                    </span>
                  </div>
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
                Enterprise-grade security with end-to-end encryption and
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
          <div className="bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-gray-700 rounded-2xl p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-blue-500/5 to-purple-500/5"></div>
            <div className="relative">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                <span className="text-green-400 text-sm font-medium">
                  SECURE & ENCRYPTED
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Transform Your Data
                <span className="block bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Securely & Privately?
                </span>
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
                Join thousands of users who trust Insighter with their most
                sensitive data. Experience enterprise-grade security with
                end-to-end encryption, zero-knowledge architecture, and complete
                data privacy.
              </p>

              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <div className="flex items-center px-4 py-2 bg-gray-800/50 rounded-lg">
                  <svg
                    className="w-5 h-5 text-green-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span className="text-white text-sm">
                    End-to-End Encrypted
                  </span>
                </div>
                <div className="flex items-center px-4 py-2 bg-gray-800/50 rounded-lg">
                  <svg
                    className="w-5 h-5 text-blue-400 mr-2"
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
                  <span className="text-white text-sm">Zero-Knowledge</span>
                </div>
                <div className="flex items-center px-4 py-2 bg-gray-800/50 rounded-lg">
                  <svg
                    className="w-5 h-5 text-purple-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-white text-sm">Privacy First</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!isClient ? (
                // Show loading state during hydration
                <div className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg">
                  Loading...
                </div>
              ) : isAuthenticated ? (
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
