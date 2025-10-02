import React from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-white mb-8">Refund Policy</h1>

          <div className="text-gray-300 space-y-6">
            <p className="text-sm text-gray-400 mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                1. Overview
              </h2>
              <p>
                At Insighter, we strive to provide excellent service and
                customer satisfaction. This Refund Policy outlines the
                circumstances under which refunds may be issued for our
                AI-powered data analytics platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                2. Credit-Based System
              </h2>
              <p>
                Our platform operates on a credit-based system where users
                purchase credits in advance to use our services. Credits are
                consumed based on usage, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>AI-powered data queries and analysis</li>
                <li>Database connections and data processing</li>
                <li>Visualization generation</li>
                <li>File processing and summarization</li>
                <li>API calls and integrations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                3. Refund Eligibility
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Eligible for Refund
                  </h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      Technical issues preventing service usage within 7 days of
                      purchase
                    </li>
                    <li>Duplicate payments made in error</li>
                    <li>Service outages lasting more than 24 hours</li>
                    <li>Billing errors on our part</li>
                    <li>
                      Unused credits within 30 days of purchase (partial refund)
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Not Eligible for Refund
                  </h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Credits consumed through normal usage</li>
                    <li>Change of mind after using the service</li>
                    <li>Failure to understand the service before purchase</li>
                    <li>Violation of Terms of Service</li>
                    <li>Refund requests made after 30 days of purchase</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                4. Refund Process
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Step 1: Contact Support
                  </h3>
                  <p>
                    Submit a refund request by contacting our support team at
                    <a
                      href="mailto:support@insighter.ai"
                      className="text-blue-400 hover:underline ml-1"
                    >
                      support@insighter.ai
                    </a>{" "}
                    with:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                    <li>Your account email address</li>
                    <li>Transaction ID or payment reference</li>
                    <li>Reason for refund request</li>
                    <li>Supporting documentation if applicable</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Step 2: Review Process
                  </h3>
                  <p>
                    Our team will review your request within 2-3 business days
                    and may request additional information to process your
                    refund.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Step 3: Refund Processing
                  </h3>
                  <p>
                    If approved, refunds will be processed within 5-10 business
                    days to your original payment method.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                5. Refund Amounts
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Full Refund
                  </h3>
                  <p>Issued for:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Technical issues preventing service usage</li>
                    <li>Duplicate payments</li>
                    <li>Billing errors</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Partial Refund
                  </h3>
                  <p>Issued for:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Unused credits (proportional to unused amount)</li>
                    <li>Service issues affecting partial functionality</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                6. Processing Times
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-600">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="border border-gray-600 p-3 text-left">
                        Payment Method
                      </th>
                      <th className="border border-gray-600 p-3 text-left">
                        Processing Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-600 p-3">
                        Credit/Debit Cards
                      </td>
                      <td className="border border-gray-600 p-3">
                        5-10 business days
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-600 p-3">
                        Net Banking
                      </td>
                      <td className="border border-gray-600 p-3">
                        3-7 business days
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-600 p-3">UPI</td>
                      <td className="border border-gray-600 p-3">
                        1-3 business days
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-600 p-3">
                        Digital Wallets
                      </td>
                      <td className="border border-gray-600 p-3">
                        1-5 business days
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                7. Dispute Resolution
              </h2>
              <p>If you disagree with our refund decision, you can:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>Request a review by our management team</li>
                <li>Provide additional documentation or evidence</li>
                <li>
                  Contact your payment provider for chargeback (if applicable)
                </li>
                <li>Seek mediation through consumer protection agencies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                8. Currency and Fees
              </h2>
              <p>
                Refunds will be processed in the same currency as the original
                payment. Any processing fees charged by payment providers may be
                deducted from the refund amount.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                9. Contact Information
              </h2>
              <p>
                For refund requests or questions about this policy, please
                contact us:
              </p>
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <p>
                  <strong>Email:</strong> support@insighter.ai
                </p>
                <p>
                  <strong>Subject:</strong> Refund Request - [Your Transaction
                  ID]
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
                10. Policy Updates
              </h2>
              <p>
                We reserve the right to modify this Refund Policy at any time.
                Changes will be effective immediately upon posting on our
                website. Continued use of our service after changes constitutes
                acceptance of the updated policy.
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
