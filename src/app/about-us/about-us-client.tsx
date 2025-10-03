"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

const AboutUsClient: React.FC = () => {
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
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Mission-Driven Innovation
            </h2>
            <p className="text-lg text-foreground-muted mb-6">
              At Insighter, we believe that data should be accessible to
              everyone, not just data scientists. Our mission is to democratize
              data analytics by making complex insights available through
              simple, natural language conversations.
            </p>
            <p className="text-lg text-foreground-muted mb-8">
              We're building the future of business intelligence where AI meets
              human intuition, creating a seamless bridge between raw data and
              actionable insights.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/pricing"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/contact-us"
                className="border border-gray-300 text-foreground px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/5 p-6 rounded-lg">
              <div className="text-3xl font-bold text-blue-400 mb-2">10K+</div>
              <div className="text-foreground-muted">
                Data Sources Connected
              </div>
            </div>
            <div className="bg-white/5 p-6 rounded-lg">
              <div className="text-3xl font-bold text-green-400 mb-2">500+</div>
              <div className="text-foreground-muted">Organizations Served</div>
            </div>
            <div className="bg-white/5 p-6 rounded-lg">
              <div className="text-3xl font-bold text-purple-400 mb-2">1M+</div>
              <div className="text-foreground-muted">Insights Generated</div>
            </div>
            <div className="bg-white/5 p-6 rounded-lg">
              <div className="text-3xl font-bold text-orange-400 mb-2">
                99.9%
              </div>
              <div className="text-foreground-muted">Uptime Guarantee</div>
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="bg-gray-50 dark:bg-gray-900 py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Our Core Values
            </h2>
            <p className="text-xl text-foreground-muted max-w-3xl mx-auto">
              The principles that guide everything we do at Insighter
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
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
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Innovation First
              </h3>
              <p className="text-foreground-muted">
                We constantly push the boundaries of what's possible with AI and
                data analytics, always looking for better ways to serve our
                users.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                User-Centric
              </h3>
              <p className="text-foreground-muted">
                Every feature we build is designed with our users in mind. We
                believe technology should adapt to humans, not the other way
                around.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Reliability
              </h3>
              <p className="text-foreground-muted">
                We understand that businesses depend on our platform. That's why
                we maintain the highest standards of security, performance, and
                reliability.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Section */}
      <div className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Meet Our Team
            </h2>
            <p className="text-xl text-foreground-muted max-w-3xl mx-auto">
              The passionate individuals behind Insighter's success
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">AI</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                AI Research Team
              </h3>
              <p className="text-foreground-muted mb-4">
                Leading experts in machine learning and natural language
                processing
              </p>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                PhD in Computer Science
              </div>
            </div>

            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">DEV</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Engineering Team
              </h3>
              <p className="text-foreground-muted mb-4">
                Full-stack developers building scalable, secure platforms
              </p>
              <div className="text-sm text-green-600 dark:text-green-400">
                10+ Years Experience
              </div>
            </div>

            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">UX</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Product Team
              </h3>
              <p className="text-foreground-muted mb-4">
                UX designers and product managers focused on user experience
              </p>
              <div className="text-sm text-purple-600 dark:text-purple-400">
                Design Thinking Experts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Data?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of organizations already using Insighter to unlock
            the power of their data.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact-us"
              className="border border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Schedule Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUsClient;
