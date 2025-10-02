"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

const AboutUsPage: React.FC = () => {
  const { trackFeatureUsage } = useAnalytics();
  const authContext = useSupabaseAuth();
  const { user: _user } = authContext || {};

  // Track page view
  useEffect(() => {
    trackFeatureUsage("about_us_page_viewed", {
      page: "about_us",
      section: "hero",
    });
  }, [trackFeatureUsage]);

  return (
    <div className="min-h-screen bg-background">
      {/* About Section with Stats */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-6">Our Story</h1>
          <p className="text-xl text-foreground-muted max-w-3xl mx-auto">
            Transforming how organizations interact with their data through
            intelligent AI-powered analytics.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column - Story */}
          <div>
            <p className="text-xl text-foreground-muted mb-8 leading-relaxed">
              Born from the innovative minds at{" "}
              <span className="text-primary-400 font-semibold">Klair Labs</span>
              , Insighter represents a revolutionary approach to data analytics.
              We discovered a critical gap: decision makers need information and
              data for decisions, but technical experts take days to generate
              responses and provide insights. This delay was costing
              organizations opportunities and competitive advantage.
            </p>
            <p className="text-lg text-foreground-muted mb-8 leading-relaxed">
              We set out to bridge this gap and reduce the time from request to
              decision from{" "}
              <span className="text-primary-400 font-semibold">
                days to minutes, if not seconds
              </span>
              . Through extensive research and development in AI and natural
              language processing, we created a platform that transforms complex
              data queries into simple conversations. Our AI understands
              business context and provides relevant, actionable insights
              instantly.
            </p>
            <p className="text-lg text-foreground-muted leading-relaxed">
              <strong className="text-foreground">Our Vision:</strong> To create
              a world where every organization, regardless of size or technical
              expertise, can harness the full power of their data to make
              informed decisions that drive meaningful impact. We envision a
              future where data analytics becomes as intuitive as having a
              conversation.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a
                href="https://klairtech.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-lg transition-all duration-200 border border-primary-500/20 hover:border-primary-400/40"
                onClick={() => {
                  trackFeatureUsage("klairtech_redirect_clicked", {
                    page: "about_us",
                    source: "story_section",
                  });
                }}
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Learn More About Klair Labs
              </a>
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-foreground bg-background-alt hover:bg-background-alt/80 rounded-lg transition-all duration-200 border border-border hover:border-border-hover"
              >
                Get Started with Insighter
              </Link>
            </div>
          </div>

          {/* Right Column - Stats */}
          <div className="relative">
            <div className="bg-background/50 backdrop-blur-sm border border-border rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Trusted by Organizations Worldwide
                </h3>
                <p className="text-foreground-muted">
                  Our platform delivers enterprise-grade performance and
                  reliability
                </p>
              </div>

              <div className="space-y-6">
                {/* 50+ Data Sources */}
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center">
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
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      50+
                    </div>
                    <div className="text-foreground-muted">Data Sources</div>
                    <div className="text-xs text-blue-400 flex items-center mt-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
                      Universal Connectivity
                    </div>
                  </div>
                </div>

                {/* Enterprise Security */}
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
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
                    <div className="text-2xl font-bold text-foreground">
                      Enterprise
                    </div>
                    <div className="text-foreground-muted">Security</div>
                    <div className="text-xs text-green-400 flex items-center mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                      Military-Grade
                    </div>
                  </div>
                </div>

                {/* 99.9% Uptime */}
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
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      99.9%
                    </div>
                    <div className="text-foreground-muted">Uptime</div>
                    <div className="text-xs text-purple-400 flex items-center mt-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse mr-2"></div>
                      Always Available
                    </div>
                  </div>
                </div>

                {/* <2min Setup Time */}
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
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
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      &lt;2min
                    </div>
                    <div className="text-foreground-muted">Setup Time</div>
                    <div className="text-xs text-orange-400 flex items-center mt-1">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse mr-2"></div>
                      Instant Start
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Our Core Values
          </h2>
          <p className="text-xl text-foreground-muted max-w-3xl mx-auto">
            These principles guide everything we do, from product development to
            client relationships.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Clarity */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-background/50 backdrop-blur-sm border border-border rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-500 group-hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Clarity
              </h3>
              <p className="text-foreground-muted leading-relaxed">
                We believe in simplifying the complex. Our mission is to make
                advanced AI and data insights accessible to everyone, regardless
                of technical background.
              </p>
            </div>
          </div>

          {/* Trust */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-background/50 backdrop-blur-sm border border-border rounded-2xl p-8 hover:border-green-500/50 transition-all duration-500 group-hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
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
              <h3 className="text-2xl font-bold text-foreground mb-4">Trust</h3>
              <p className="text-foreground-muted leading-relaxed">
                Security, compliance, and ethics are at the core of everything
                we build. We maintain the highest standards of data protection
                and responsible AI practices.
              </p>
            </div>
          </div>

          {/* Innovation */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-background/50 backdrop-blur-sm border border-border rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-500 group-hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Innovation
              </h3>
              <p className="text-foreground-muted leading-relaxed">
                We continuously push the boundaries of what&apos;s possible with
                AI and data science, staying ahead of the curve in technology
                and methodology.
              </p>
            </div>
          </div>

          {/* Impact */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-background/50 backdrop-blur-sm border border-border rounded-2xl p-8 hover:border-orange-500/50 transition-all duration-500 group-hover:scale-105">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500">
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Impact
              </h3>
              <p className="text-foreground-muted leading-relaxed">
                We measure success not just by technical achievements, but by
                the real-world impact our solutions create for organizations and
                communities.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Technology & AI Section */}
      <div className="bg-gradient-to-r from-primary-500/10 to-primary-600/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Powered by Advanced AI & Machine Learning
            </h2>
            <p className="text-xl text-foreground-muted max-w-3xl mx-auto">
              Our AI and ML algorithms continuously learn and adapt to provide
              increasingly accurate insights and predictions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Natural Language Processing
              </h3>
              <p className="text-foreground-muted">
                Understands business context and translates queries into
                insights.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-primary-400"
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
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Real-time Analytics
              </h3>
              <p className="text-foreground-muted">
                Lightning-fast processing that delivers insights in seconds.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-primary-400"
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
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Enterprise Security
              </h3>
              <p className="text-foreground-muted">
                Military-grade encryption and zero-knowledge architecture.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Adaptive Learning
              </h3>
              <p className="text-foreground-muted">
                ML models continuously learn from user interactions and data
                patterns.
              </p>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-3xl font-bold text-foreground mb-6">
              Ready to Get Started?
            </h3>
            <p className="text-xl text-foreground-muted mb-12 max-w-2xl mx-auto">
              Join organizations making data-driven decisions with AI-powered
              analytics.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 rounded-lg transition-all duration-200 border border-primary-500/20 hover:border-primary-400/40"
              >
                Start Free Trial
              </Link>
              <Link
                href="/contact-us"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-foreground bg-background-alt hover:bg-background-alt/80 rounded-lg transition-all duration-200 border border-border hover:border-border-hover"
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

export default AboutUsPage;
