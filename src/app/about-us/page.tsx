"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

const AboutUsPage: React.FC = () => {
  const { trackFeatureUsage } = useAnalytics();
  const authContext = useSupabaseAuth();
  const { user } = authContext || {};

  // Track page view
  useEffect(() => {
    trackFeatureUsage("about_us_page_viewed", {
      page: "about_us",
      section: "hero",
    });
  }, [trackFeatureUsage]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="mb-4">
              <span className="inline-block px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                A Product of Klair Labs
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              About Insighter
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Born from Klair Labs&apos; vision to democratize decision-making
              power through advanced analytics and secure information access.
            </p>
            {!user && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://klairtech.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 text-lg font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 border border-blue-500/20 hover:border-blue-400/40"
                  onClick={() => {
                    trackFeatureUsage("klairtech_redirect_clicked", {
                      page: "about_us",
                      source: "hero_section",
                    });
                  }}
                >
                  <svg
                    className="w-5 h-5 mr-2"
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
                  className="inline-flex items-center justify-center px-6 py-3 text-lg font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 border border-white/20 hover:border-white/40"
                >
                  Get Started with Insighter
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Our Story Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-6">Our Story</h2>
            <p className="text-lg text-gray-300 mb-6">
              Insighter emerged from{" "}
              <strong className="text-blue-400">Klair Labs</strong>, an
              innovative initiative by Klair Technology Solutions where we
              experiment with multiple AI and data use cases. Through our
              extensive research and development, we identified a critical gap
              in the market.
            </p>
            <p className="text-lg text-gray-300 mb-6">
              While organizations had access to vast amounts of data, the power
              to make informed decisions remained concentrated among those with
              technical expertise. We envisioned a world where every stakeholder
              could harness the full potential of their data.
            </p>
            <p className="text-lg text-gray-300">
              Today, Insighter stands as a testament to our commitment to
              democratizing decision-making power through secure, accessible,
              and intelligent analytics.
            </p>
          </div>
          <div className="klair-card p-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold klair-gradient-text mb-2">
                  50+
                </div>
                <div className="text-sm text-gray-400">Data Sources</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold klair-gradient-text mb-2">
                  Enterprise
                </div>
                <div className="text-sm text-gray-400">Security</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold klair-gradient-text mb-2">
                  99.9%
                </div>
                <div className="text-sm text-gray-400">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold klair-gradient-text mb-2">
                  &lt;2min
                </div>
                <div className="text-sm text-gray-400">Setup Time</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mission & Vision Section */}
      <div className="bg-gradient-to-br from-blue-500/5 to-blue-600/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="text-center lg:text-left">
              <div className="klair-icon-container w-16 h-16 mx-auto lg:mx-0 mb-6">
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
              <h2 className="text-3xl font-bold text-white mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-gray-300 mb-4">
                To democratize decision-making power by providing secure,
                accessible, and intelligent analytics that empower every
                stakeholder to make data-driven decisions with confidence.
              </p>
              <p className="text-lg text-gray-300">
                We believe that advanced analytics should not be a privilege of
                the few, but a fundamental right for every organization seeking
                to thrive in the data-driven economy.
              </p>
            </div>

            <div className="text-center lg:text-left">
              <div className="klair-icon-container w-16 h-16 mx-auto lg:mx-0 mb-6">
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
              <h2 className="text-3xl font-bold text-white mb-6">Our Vision</h2>
              <p className="text-lg text-gray-300 mb-4">
                To create a world where every organization, regardless of size
                or technical expertise, can harness the full power of their data
                to make informed decisions that drive meaningful impact.
              </p>
              <p className="text-lg text-gray-300">
                We envision a future where data analytics becomes as intuitive
                as having a conversation, where insights are delivered securely
                and instantly, and where every decision is backed by
                comprehensive, real-time intelligence.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Our Values</h2>
          <p className="text-lg text-gray-300">
            The principles that guide everything we do at Klair Labs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="klair-icon-container w-16 h-16 mx-auto mb-4">
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
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Democratization
            </h3>
            <p className="text-gray-400">
              Making advanced analytics accessible to everyone, regardless of
              technical background or organizational size.
            </p>
          </div>

          <div className="text-center">
            <div className="klair-icon-container w-16 h-16 mx-auto mb-4">
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
            <h3 className="text-lg font-semibold text-white mb-2">Security</h3>
            <p className="text-gray-400">
              Enterprise-grade security and privacy protection for all data and
              insights, ensuring complete trust and compliance.
            </p>
          </div>

          <div className="text-center">
            <div className="klair-icon-container w-16 h-16 mx-auto mb-4">
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
            <h3 className="text-lg font-semibold text-white mb-2">
              Innovation
            </h3>
            <p className="text-gray-400">
              Continuously pushing the boundaries of AI and data analytics
              through cutting-edge research and development.
            </p>
          </div>

          <div className="text-center">
            <div className="klair-icon-container w-16 h-16 mx-auto mb-4">
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
            <h3 className="text-lg font-semibold text-white mb-2">Impact</h3>
            <p className="text-gray-400">
              Delivering measurable results that drive meaningful business
              outcomes and create lasting value for our users.
            </p>
          </div>
        </div>
      </div>

      {/* Klair Labs Section */}
      <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Powered by Klair Labs
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              Insighter is just one of many innovative solutions emerging from
              our experimental lab, where we explore the intersection of AI,
              data, and real-world applications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="klair-icon-container w-16 h-16 mx-auto mb-4">
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
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Research & Development
              </h3>
              <p className="text-gray-400">
                Continuous experimentation with cutting-edge AI and data
                technologies to solve real-world challenges.
              </p>
            </div>

            <div className="text-center">
              <div className="klair-icon-container w-16 h-16 mx-auto mb-4">
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
              <h3 className="text-lg font-semibold text-white mb-2">
                Innovation Pipeline
              </h3>
              <p className="text-gray-400">
                Multiple use cases and applications in development, with
                Insighter leading the way in democratizing analytics.
              </p>
            </div>

            <div className="text-center">
              <div className="klair-icon-container w-16 h-16 mx-auto mb-4">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Community Impact
              </h3>
              <p className="text-gray-400">
                Building solutions that create meaningful impact across
                industries and empower organizations worldwide.
              </p>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-4">
              Ready to Experience the Future of Analytics?
            </h3>
            <p className="text-xl text-gray-300 mb-8">
              Join organizations already making data-driven decisions with
              Insighter, powered by Klair Labs innovation.
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
              {!user && (
                <a
                  href="https://klairtech.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 border border-blue-500/20 hover:border-blue-400/40"
                  onClick={() => {
                    trackFeatureUsage("klairtech_redirect_clicked", {
                      page: "about_us",
                      source: "cta_section",
                    });
                  }}
                >
                  <svg
                    className="w-5 h-5 mr-2"
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
                  Visit Klairtech.com
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUsPage;
