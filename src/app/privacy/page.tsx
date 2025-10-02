import React from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>

          <div className="text-gray-300 space-y-6">
            <p className="text-sm text-gray-400 mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                1. Information We Collect
              </h2>
              <div className="space-y-4">
                <h3 className="text-xl font-medium text-white">
                  Personal Information
                </h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Email address and name when you create an account</li>
                  <li>
                    Payment information processed securely through Razorpay
                  </li>
                  <li>Usage data and analytics to improve our service</li>
                  <li>
                    Database connection details (encrypted and stored securely)
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                2. How We Use Your Information
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  Provide and maintain our AI-powered data analytics service
                </li>
                <li>Process payments and manage your subscription</li>
                <li>Send important service updates and notifications</li>
                <li>Improve our platform through usage analytics</li>
                <li>Provide customer support</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                3. Data Security
              </h2>
              <p>
                We implement industry-standard security measures to protect your
                data:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>All data is encrypted in transit and at rest</li>
                <li>Database connections use secure protocols</li>
                <li>
                  Payment information is processed by certified payment
                  processors
                </li>
                <li>Regular security audits and monitoring</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                4. Data Sharing
              </h2>
              <p>
                We do not sell, trade, or rent your personal information to
                third parties. We may share data only in these limited
                circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>With your explicit consent</li>
                <li>To comply with legal obligations</li>
                <li>
                  With trusted service providers who assist in our operations
                </li>
                <li>In case of business transfer or merger</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                5. Your Rights
              </h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and data</li>
                <li>Export your data</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                6. Cookies and Tracking
              </h2>
              <p>
                We use cookies and similar technologies to enhance your
                experience, analyze usage, and provide personalized content. You
                can manage cookie preferences in your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                7. Contact Us
              </h2>
              <p>
                If you have questions about this Privacy Policy, please contact
                us at:
              </p>
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <p>
                  <strong>Email:</strong> privacy@insighter.ai
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

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                8. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by posting the new Privacy Policy on
                this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
