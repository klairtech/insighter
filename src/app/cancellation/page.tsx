import React from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function CancellationPolicy() {
  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-white mb-8">
            Cancellation Policy
          </h1>

          <div className="text-gray-300 space-y-6">
            <p className="text-sm text-gray-400 mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                1. Overview
              </h2>
              <p>
                This Cancellation Policy outlines the terms and conditions for
                canceling your account, subscriptions, and services with
                Insighter. We understand that circumstances may change, and we
                aim to provide a fair and transparent cancellation process.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                2. Account Cancellation
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Self-Service Cancellation
                  </h3>
                  <p>You can cancel your account at any time through:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                    <li>Account settings in your dashboard</li>
                    <li>Profile page cancellation option</li>
                    <li>Contacting our support team</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Immediate Effect
                  </h3>
                  <p>
                    Account cancellation takes effect immediately upon
                    confirmation. You will lose access to all services and data
                    associated with your account.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                3. Data Handling Upon Cancellation
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Data Retention
                  </h3>
                  <p>Upon account cancellation:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Your personal data will be deleted within 30 days</li>
                    <li>
                      Workspace data and files will be permanently removed
                    </li>
                    <li>Database connections will be terminated</li>
                    <li>Usage analytics will be anonymized</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Data Export
                  </h3>
                  <p>
                    Before canceling, you can export your data through our
                    dashboard. We recommend downloading important files and
                    configurations before proceeding with cancellation.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                4. Credit and Billing
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Unused Credits
                  </h3>
                  <p>
                    Upon account cancellation, any unused credits in your
                    account will be forfeited. We recommend using all available
                    credits before canceling your account.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    No Refunds for Cancellation
                  </h3>
                  <p>
                    Account cancellation does not automatically entitle you to a
                    refund. Refunds are handled separately according to our
                    Refund Policy.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Outstanding Payments
                  </h3>
                  <p>
                    Any outstanding payments or fees must be settled before
                    account cancellation can be completed.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                5. Organization and Workspace Cancellation
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Organization Owner
                  </h3>
                  <p>
                    If you are the owner of an organization, canceling your
                    account will affect all members. You should:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                    <li>Transfer ownership to another member</li>
                    <li>Notify all members of the cancellation</li>
                    <li>Export shared data and configurations</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Organization Member
                  </h3>
                  <p>
                    As a member, you can leave an organization without canceling
                    your personal account. This will remove your access to
                    organization workspaces and shared resources.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                6. Service-Specific Cancellation
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Database Connections
                  </h3>
                  <p>
                    Database connections can be terminated individually without
                    canceling your entire account. This will stop data
                    processing but preserve your account and other services.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    External Integrations
                  </h3>
                  <p>
                    External service integrations (Google Sheets, Analytics,
                    etc.) can be disconnected through your dashboard settings.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">API Access</h3>
                  <p>
                    API tokens and access can be revoked individually or all at
                    once through your account settings.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                7. Cancellation Process
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Step 1: Review Impact
                  </h3>
                  <p>Before canceling, review what will be affected:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                    <li>All your workspaces and data</li>
                    <li>Organization memberships</li>
                    <li>Unused credits</li>
                    <li>Active integrations</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Step 2: Export Data
                  </h3>
                  <p>
                    Download any important data, configurations, or files you
                    want to keep.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Step 3: Initiate Cancellation
                  </h3>
                  <p>
                    Use the cancellation option in your account settings or
                    contact support.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Step 4: Confirmation
                  </h3>
                  <p>
                    Confirm your cancellation request. This action is
                    irreversible.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                8. Reinstatement
              </h2>
              <p>
                Once an account is canceled, it cannot be reinstated. If you
                wish to use our services again, you will need to create a new
                account and start fresh.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                9. Force Cancellation
              </h2>
              <p>We reserve the right to cancel accounts that:</p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>Violate our Terms of Service</li>
                <li>Engage in fraudulent activities</li>
                <li>Fail to pay outstanding fees</li>
                <li>Pose security risks to our platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                10. Contact Information
              </h2>
              <p>
                For questions about cancellation or to initiate the process,
                contact us:
              </p>
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <p>
                  <strong>Email:</strong> support@insighter.ai
                </p>
                <p>
                  <strong>Subject:</strong> Account Cancellation Request
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
