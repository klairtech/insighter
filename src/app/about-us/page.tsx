"use client";

import React from "react";
import Link from "next/link";

const AboutUsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              About Insighter
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              We&apos;re on a mission to democratize data analytics by making it
              accessible to everyone, regardless of technical expertise.
            </p>
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-lg text-gray-300 mb-6">
              At Insighter, we believe that data-driven insights should be
              accessible to everyone. Our platform transforms complex data
              analysis into simple, natural language conversations, empowering
              teams to make better decisions faster.
            </p>
            <p className="text-lg text-gray-300">
              We&apos;re building the future where anyone can ask questions
              about their data and get intelligent, actionable answers without
              needing to learn SQL or complex analytics tools.
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
                  24/7
                </div>
                <div className="text-sm text-gray-400">Support</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold klair-gradient-text mb-2">
                  99.9%
                </div>
                <div className="text-sm text-gray-400">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold klair-gradient-text mb-2">
                  2min
                </div>
                <div className="text-sm text-gray-400">Setup Time</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Section */}
      <div className="bg-gradient-to-br from-blue-500/5 to-blue-600/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Meet Our Team
            </h2>
            <p className="text-lg text-gray-300">
              We&apos;re a passionate team of data scientists, engineers, and
              designers working together to revolutionize data analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="klair-icon-container w-24 h-24 mx-auto mb-4">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Sarah Johnson
              </h3>
              <p className="text-blue-400 mb-2">CEO & Co-Founder</p>
              <p className="text-sm text-gray-400">
                Former data scientist at Google with 10+ years of experience in
                AI and machine learning.
              </p>
            </div>

            <div className="text-center">
              <div className="klair-icon-container w-24 h-24 mx-auto mb-4">
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
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Michael Chen
              </h3>
              <p className="text-blue-400 mb-2">CTO & Co-Founder</p>
              <p className="text-sm text-gray-400">
                Full-stack engineer with expertise in distributed systems and
                real-time data processing.
              </p>
            </div>

            <div className="text-center">
              <div className="klair-icon-container w-24 h-24 mx-auto mb-4">
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
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Emily Rodriguez
              </h3>
              <p className="text-blue-400 mb-2">Head of Design</p>
              <p className="text-sm text-gray-400">
                UX designer focused on creating intuitive interfaces for complex
                data visualization tools.
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
            The principles that guide everything we do
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
              We constantly push the boundaries of what&apos;s possible in data
              analytics and AI.
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
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Accessibility
            </h3>
            <p className="text-gray-400">
              We believe powerful analytics should be accessible to everyone,
              not just data scientists.
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Trust</h3>
            <p className="text-gray-400">
              We prioritize security, privacy, and reliability in everything we
              build.
            </p>
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

export default AboutUsPage;
