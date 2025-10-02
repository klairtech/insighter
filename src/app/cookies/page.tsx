import React from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function CookiesPolicy() {
  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-white mb-8">Cookies Policy</h1>

          <div className="text-gray-300 space-y-6">
            <p className="text-sm text-gray-400 mb-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                1. What Are Cookies
              </h2>
              <p>
                Cookies are small text files that are placed on your computer or
                mobile device when you visit our website. They help us provide
                you with a better experience by remembering your preferences and
                enabling certain functionality.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                2. How We Use Cookies
              </h2>
              <p>We use cookies for several purposes:</p>

              <div className="space-y-4 mt-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Essential Cookies
                  </h3>
                  <p>
                    These cookies are necessary for the website to function
                    properly:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                    <li>Authentication and session management</li>
                    <li>Security and fraud prevention</li>
                    <li>Load balancing and performance</li>
                    <li>Remembering your login status</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Analytics Cookies
                  </h3>
                  <p>
                    These cookies help us understand how you use our website:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                    <li>Page views and user interactions</li>
                    <li>Time spent on pages</li>
                    <li>Error tracking and debugging</li>
                    <li>Performance monitoring</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Preference Cookies
                  </h3>
                  <p>These cookies remember your settings and preferences:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                    <li>Language and region settings</li>
                    <li>Theme preferences (dark/light mode)</li>
                    <li>Dashboard layout preferences</li>
                    <li>Notification settings</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                3. Third-Party Cookies
              </h2>
              <p>We may use third-party services that set their own cookies:</p>

              <div className="space-y-4 mt-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Google Analytics
                  </h3>
                  <p>
                    We use Google Analytics to understand website usage and
                    improve our service.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Payment Processing
                  </h3>
                  <p>
                    Razorpay and other payment processors may set cookies for
                    transaction security.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Authentication
                  </h3>
                  <p>
                    Supabase and OAuth providers may set cookies for secure
                    authentication.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                4. Cookie Categories
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-600">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="border border-gray-600 p-3 text-left">
                        Cookie Type
                      </th>
                      <th className="border border-gray-600 p-3 text-left">
                        Purpose
                      </th>
                      <th className="border border-gray-600 p-3 text-left">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-600 p-3">
                        Session Cookies
                      </td>
                      <td className="border border-gray-600 p-3">
                        Maintain your login session
                      </td>
                      <td className="border border-gray-600 p-3">
                        Until browser closes
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-600 p-3">
                        Persistent Cookies
                      </td>
                      <td className="border border-gray-600 p-3">
                        Remember preferences and settings
                      </td>
                      <td className="border border-gray-600 p-3">
                        30 days to 1 year
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-600 p-3">
                        Analytics Cookies
                      </td>
                      <td className="border border-gray-600 p-3">
                        Track usage and performance
                      </td>
                      <td className="border border-gray-600 p-3">2 years</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-600 p-3">
                        Security Cookies
                      </td>
                      <td className="border border-gray-600 p-3">
                        Protect against fraud and attacks
                      </td>
                      <td className="border border-gray-600 p-3">24 hours</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                5. Managing Cookies
              </h2>
              <p>You can control and manage cookies in several ways:</p>

              <div className="space-y-4 mt-4">
                <div>
                  <h3 className="text-xl font-medium text-white">
                    Browser Settings
                  </h3>
                  <p>Most browsers allow you to:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                    <li>View and delete cookies</li>
                    <li>Block cookies from specific sites</li>
                    <li>Block third-party cookies</li>
                    <li>Set preferences for cookie acceptance</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium text-white">
                    Opt-Out Options
                  </h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      Google Analytics:{" "}
                      <a
                        href="https://tools.google.com/dlpage/gaoptout"
                        className="text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google Analytics Opt-out
                      </a>
                    </li>
                    <li>Browser-based opt-out tools</li>
                    <li>Ad blocker extensions</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                6. Impact of Disabling Cookies
              </h2>
              <p>
                If you disable cookies, some features of our website may not
                work properly:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                <li>You may need to log in repeatedly</li>
                <li>Your preferences may not be saved</li>
                <li>Some interactive features may not function</li>
                <li>Personalized content may not be available</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                7. Updates to This Policy
              </h2>
              <p>
                We may update this Cookies Policy from time to time to reflect
                changes in our practices or for other operational, legal, or
                regulatory reasons. We will notify you of any material changes
                by posting the updated policy on this page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                8. Contact Us
              </h2>
              <p>
                If you have any questions about our use of cookies, please
                contact us:
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
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
