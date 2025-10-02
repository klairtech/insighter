import React from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-white mb-8">
            Terms of Service
          </h1>

          <div className="text-gray-300 space-y-6">
            <p className="text-sm text-gray-400 mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing and using Insighter (&quot;the Service&quot;), you
                accept and agree to be bound by the terms and provision of this
                agreement. If you do not agree to abide by the above, please do
                not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                2. Description of Service
              </h2>
              <p>
                Insighter is an AI-powered data analytics platform that allows
                users to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>Connect to various data sources and databases</li>
                <li>Query data using natural language</li>
                <li>Generate insights and visualizations</li>
                <li>Collaborate with team members</li>
                <li>Access AI-powered analytics and summaries</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                3. User Accounts
              </h2>
              <div className="space-y-4">
                <p>To use our Service, you must:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate and complete information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Be responsible for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized use</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                4. Acceptable Use
              </h2>
              <div className="space-y-4">
                <p>You agree not to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Use the Service for any unlawful purpose</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Interfere with or disrupt the Service</li>
                  <li>Upload malicious code or harmful content</li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Share your account credentials with others</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                5. Payment Terms
              </h2>
              <div className="space-y-4">
                <p>Our Service operates on a credit-based system:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Credits are purchased in advance</li>
                  <li>Credits are consumed based on usage</li>
                  <li>All payments are processed securely through Razorpay</li>
                  <li>Prices are subject to change with notice</li>
                  <li>Refunds are handled according to our Refund Policy</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                6. Data and Privacy
              </h2>
              <p>
                Your privacy is important to us. Please review our Privacy
                Policy, which also governs your use of the Service, to
                understand our practices.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>You retain ownership of your data</li>
                <li>We implement security measures to protect your data</li>
                <li>You can export or delete your data at any time</li>
                <li>We may use anonymized data to improve our Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                7. Intellectual Property
              </h2>
              <p>
                The Service and its original content, features, and
                functionality are owned by Klair Technology Solutions Private
                Limited and are protected by international copyright, trademark,
                patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                8. Service Availability
              </h2>
              <p>
                We strive to maintain high service availability but cannot
                guarantee uninterrupted access. We may:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>Perform scheduled maintenance</li>
                <li>Update the Service with new features</li>
                <li>Suspend service for security reasons</li>
                <li>Modify or discontinue features</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                9. Limitation of Liability
              </h2>
              <p>
                In no event shall Klair Technology Solutions Private Limited be
                liable for any indirect, incidental, special, consequential, or
                punitive damages, including without limitation, loss of profits,
                data, use, goodwill, or other intangible losses, resulting from
                your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                10. Termination
              </h2>
              <p>
                We may terminate or suspend your account immediately, without
                prior notice or liability, for any reason whatsoever, including
                without limitation if you breach the Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                11. Governing Law
              </h2>
              <p>
                These Terms shall be interpreted and governed by the laws of
                India, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                12. Contact Information
              </h2>
              <p>
                If you have any questions about these Terms of Service, please
                contact us:
              </p>
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <p>
                  <strong>Email:</strong> legal@insighter.ai
                </p>
                <p>
                  <strong>Address:</strong> Klair Technology Solutions Private
                  Limited
                </p>
                <p>
                  MCH No.10-2-289/120/30/2, 332/2RT, near Ratnadeep Supermarket
                </p>
                <p>Vijaynagar Colony, Potti Sriramulu Nagar, Masab Tank</p>
                <p>Hyderabad, Telangana 500057, India</p>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
