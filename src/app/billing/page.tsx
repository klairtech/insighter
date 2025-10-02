"use client";

import React, { useState, useEffect } from "react";

import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  CreditCard,
  Download,
  // Calendar,
  Coins,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  Plus,
  Receipt,
  History,
  Gift,
  Zap,
} from "lucide-react";
import Link from "next/link";
import CreditPurchaseModal from "@/components/CreditPurchaseModal";
import CurrencySelector from "@/components/CurrencySelector";
import {
  formatCurrency,
  // getCurrencySymbol,
  type SupportedCurrency,
} from "@/lib/pricing-utils";

interface CreditBalance {
  balance: number;
  total_purchased: number;
  total_used: number;
}

interface Purchase {
  id: string;
  credits_purchased: number;
  bonus_credits: number;
  total_credits: number;
  amount_paid: number;
  status: string;
  purchase_date: string;
  plan_type: string;
  currency?: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
}

interface Subscription {
  id: string;
  plan_type: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  monthly_credits: number;
  price_inr: number;
  is_annual: boolean;
}

interface CreditBatch {
  id: string;
  batch_code: string;
  credits_added: number;
  credits_used: number;
  credits_remaining: number;
  batch_type: string;
  plan_type: string;
  added_date: string;
  expiry_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreditUsage {
  id: string;
  batch_id: string;
  credits_used: number;
  operation_type: string;
  operation_id: string;
  description: string;
  created_at: string;
}

interface CreditStatement {
  summary: {
    total_credits_added: number;
    total_credits_used: number;
    total_credits_remaining: number;
    free_credits_added: number;
    purchased_credits_added: number;
    bonus_credits_added: number;
    expired_credits: number;
  };
  batches: CreditBatch[];
  usage_history: CreditUsage[];
}

const BillingPage: React.FC = () => {
  const authContext = useSupabaseAuth();
  const { user } = authContext || { user: null };
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(
    null
  );
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [creditStatement, setCreditStatement] =
    useState<CreditStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] =
    useState<SupportedCurrency>("INR");
  const [userCurrencyLoaded, setUserCurrencyLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"statement" | "purchases">(
    "statement"
  );

  useEffect(() => {
    if (user) {
      loadUserCurrencyPreference();
      fetchBillingData();
    }
  }, [user]);

  const loadUserCurrencyPreference = async () => {
    try {
      const response = await fetch("/api/user/currency");
      if (response.ok) {
        const data = await response.json();
        setSelectedCurrency(
          (data.preferred_currency || "INR") as SupportedCurrency
        );
      }
    } catch (error) {
      console.error("Error loading user currency preference:", error);
    } finally {
      setUserCurrencyLoaded(true);
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    setSelectedCurrency(currency as SupportedCurrency);

    // Save the currency preference to the user's profile
    try {
      const response = await fetch("/api/user/currency", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ preferred_currency: currency }),
      });

      if (!response.ok) {
        console.error("Failed to save currency preference");
      }
    } catch (error) {
      console.error("Error saving currency preference:", error);
    }

    // Refresh billing data to show updated currency
    fetchBillingData();
  };

  const fetchBillingData = async () => {
    try {
      setIsLoading(true);

      // Fetch credit balance
      const balanceResponse = await fetch("/api/credits/balance");
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setCreditBalance(balanceData);
      }

      // Fetch credit statement
      const statementResponse = await fetch("/api/credits/statement");
      if (statementResponse.ok) {
        const statementData = await statementResponse.json();
        setCreditStatement(statementData);
      }

      // Fetch purchase history
      const purchasesResponse = await fetch("/api/billing/purchases");
      if (purchasesResponse.ok) {
        const purchasesData = await purchasesResponse.json();
        setPurchases(purchasesData.purchases || []);
      }

      // Fetch subscription details
      const subscriptionResponse = await fetch("/api/billing/subscription");
      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        setSubscription(subscriptionData.subscription);
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const _handleCreditPurchase = async (credits: number) => {
    try {
      // Create order
      const orderResponse = await fetch("/api/credits/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credits }),
      });

      if (!orderResponse.ok) {
        throw new Error("Failed to create order");
      }

      const orderData = await orderResponse.json();

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID as string,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Insighter",
        description: `Purchase ${credits} credits`,
        image: "/favicon.ico",
        order_id: orderData.order.id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const purchaseResponse = await fetch("/api/credits/purchase", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                credits: orderData.credits,
                bonus_credits: orderData.bonus_credits,
                total_credits: orderData.total_credits,
                amount_paid: orderData.order.amount,
              }),
            });

            if (purchaseResponse.ok) {
              await fetchBillingData(); // Refresh data
              setIsCreditModalOpen(false);
            }
          } catch (error) {
            console.error("Purchase error:", error);
          }
        },
        prefill: {
          name: user?.user_metadata?.name || "",
          email: user?.email || "",
          contact: "",
        },
        notes: {
          address: "",
        },
        theme: {
          color: "#3B82F6",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error("Error purchasing credits:", error);
    }
  };

  const handlePurchaseSuccess = async (_credits: number) => {
    // This function is called after successful payment to refresh data
    await fetchBillingData();
  };

  const downloadInvoice = async (purchaseId: string) => {
    try {
      const response = await fetch(`/api/billing/invoice/${purchaseId}`, {
        method: "GET",
      });

      if (response.ok) {
        // Open invoice in new tab for HTML format
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error downloading invoice:", error);
    }
  };

  const getBatchTypeIcon = (batchType: string) => {
    switch (batchType) {
      case "monthly_free":
        return <Gift className="w-4 h-4 text-green-400" />;
      case "welcome":
        return <Zap className="w-4 h-4 text-blue-400" />;
      case "purchase":
        return <CreditCard className="w-4 h-4 text-yellow-400" />;
      case "bonus":
        return <Coins className="w-4 h-4 text-purple-400" />;
      default:
        return <Coins className="w-4 h-4 text-gray-400" />;
    }
  };

  const getBatchTypeLabel = (batchType: string) => {
    switch (batchType) {
      case "monthly_free":
        return "Monthly Free Credits";
      case "welcome":
        return "Welcome Credits";
      case "purchase":
        return "Paid Credits";
      case "bonus":
        return "Bonus Credits";
      default:
        return "Credits";
    }
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) <= new Date();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white">Loading billing information...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Billing & Credits
              </h1>
              <p className="text-gray-400 mt-2">
                Manage your credits, view invoices, and subscription details
              </p>
            </div>
            {userCurrencyLoaded && (
              <CurrencySelector
                onCurrencyChange={handleCurrencyChange}
                initialCurrency={selectedCurrency}
              />
            )}
          </div>
        </div>

        {/* Credit Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Available Credits</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {creditBalance?.balance || 0}
                </p>
              </div>
              <Coins className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Earned</p>
                <p className="text-2xl font-bold text-green-400">
                  {creditBalance?.total_purchased || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Credits Used</p>
                <p className="text-2xl font-bold text-blue-400">
                  {creditBalance?.total_used || 0}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setIsCreditModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Buy Credits
            </button>
            <Link
              href="/pricing"
              className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              View Plans
            </Link>
          </div>
        </div>

        {/* Current Subscription */}
        {subscription && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Subscription</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-400 text-sm">Plan Type</p>
                <p className="text-lg font-medium capitalize">
                  {subscription.plan_type}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <div className="flex items-center">
                  {subscription.status === "active" ? (
                    <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-400 mr-2" />
                  )}
                  <span className="capitalize">{subscription.status}</span>
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Monthly Credits</p>
                <p className="text-lg font-medium">
                  {subscription.monthly_credits}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Next Billing</p>
                <p className="text-lg font-medium">
                  {new Date(
                    subscription.current_period_end
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          {/* Tab Headers */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab("statement")}
              className={`flex items-center px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "statement"
                  ? "text-blue-400 border-b-2 border-blue-400 bg-gray-750"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Credit Statement
            </button>
            <button
              onClick={() => setActiveTab("purchases")}
              className={`flex items-center px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "purchases"
                  ? "text-blue-400 border-b-2 border-blue-400 bg-gray-750"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <History className="w-4 h-4 mr-2" />
              Purchase History & Invoices
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "statement" ? (
              <div>
                <h2 className="text-xl font-semibold mb-6">Credit Statement</h2>

                {/* Credit Types Explanation */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium text-blue-300 mb-2">
                    Credit Types Explained:
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-300">
                    <div className="flex items-center">
                      <Gift className="w-4 h-4 text-green-400 mr-2" />
                      <span>
                        <strong>Free Credits:</strong> Monthly free credits +
                        Welcome credits
                      </span>
                    </div>
                    <div className="flex items-center">
                      <CreditCard className="w-4 h-4 text-yellow-400 mr-2" />
                      <span>
                        <strong>Paid Credits:</strong> Credits purchased with
                        money
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Coins className="w-4 h-4 text-purple-400 mr-2" />
                      <span>
                        <strong>Bonus Credits:</strong> Extra credits from
                        promotions
                      </span>
                    </div>
                    <div className="flex items-center">
                      <AlertCircle className="w-4 h-4 text-red-400 mr-2" />
                      <span>
                        <strong>Expired:</strong> Credits that have expired
                      </span>
                    </div>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Free Credits</p>
                        <p className="text-lg font-semibold text-green-400">
                          {creditStatement?.summary.free_credits_added || 0}
                        </p>
                      </div>
                      <Gift className="w-6 h-6 text-green-400" />
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Paid Credits</p>
                        <p className="text-lg font-semibold text-yellow-400">
                          {creditStatement?.summary.purchased_credits_added ||
                            0}
                        </p>
                      </div>
                      <CreditCard className="w-6 h-6 text-yellow-400" />
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Bonus Credits</p>
                        <p className="text-lg font-semibold text-purple-400">
                          {creditStatement?.summary.bonus_credits_added || 0}
                        </p>
                      </div>
                      <Coins className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Expired</p>
                        <p className="text-lg font-semibold text-red-400">
                          {creditStatement?.summary.expired_credits || 0}
                        </p>
                      </div>
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                  </div>
                </div>

                {/* Credit Batches */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-4">Credit Batches</h3>
                  {creditStatement?.batches.length === 0 ? (
                    <div className="text-center py-8">
                      <Coins className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400">No credit batches found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {creditStatement?.batches.map((batch) => (
                        <div
                          key={batch.id}
                          className={`bg-gray-700 rounded-lg p-4 border ${
                            isExpired(batch.expiry_date)
                              ? "border-red-500/50"
                              : "border-gray-600"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {getBatchTypeIcon(batch.batch_type)}
                              <div>
                                <p className="font-medium text-white">
                                  {getBatchTypeLabel(batch.batch_type)}
                                </p>
                                <p className="text-sm text-gray-400">
                                  Added:{" "}
                                  {new Date(
                                    batch.added_date
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white">
                                {batch.credits_remaining} /{" "}
                                {batch.credits_added}
                              </p>
                              <p className="text-sm text-gray-400">
                                Expires:{" "}
                                {new Date(
                                  batch.expiry_date
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {isExpired(batch.expiry_date) && (
                            <div className="mt-2 text-sm text-red-400">
                              ⚠️ This batch has expired
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Usage History */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Recent Usage</h3>
                  {creditStatement?.usage_history.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400">No usage history found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-600">
                            <th className="text-left py-3 px-4">Date</th>
                            <th className="text-left py-3 px-4">
                              Credits Used
                            </th>
                            <th className="text-left py-3 px-4">Operation</th>
                            <th className="text-left py-3 px-4">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditStatement?.usage_history
                            .slice(0, 20)
                            .map((usage) => (
                              <tr
                                key={usage.id}
                                className="border-b border-gray-700"
                              >
                                <td className="py-3 px-4">
                                  {new Date(
                                    usage.created_at
                                  ).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 font-medium text-red-400">
                                  -{usage.credits_used}
                                </td>
                                <td className="py-3 px-4 capitalize">
                                  {usage.operation_type.replace("_", " ")}
                                </td>
                                <td className="py-3 px-4 text-gray-400">
                                  {usage.description}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Purchase History & Invoices
                </h2>
                {purchases.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">No purchases yet</p>
                    <button
                      onClick={() => setIsCreditModalOpen(true)}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Buy Your First Credits
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 px-4">Date</th>
                          <th className="text-left py-3 px-4">Credits</th>
                          <th className="text-left py-3 px-4">Amount</th>
                          <th className="text-left py-3 px-4">Status</th>
                          <th className="text-left py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((purchase) => (
                          <tr
                            key={purchase.id}
                            className="border-b border-gray-700"
                          >
                            <td className="py-3 px-4">
                              {new Date(
                                purchase.purchase_date
                              ).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div>
                                <span className="font-medium">
                                  {purchase.total_credits}
                                </span>
                                {purchase.bonus_credits > 0 && (
                                  <span className="text-green-400 text-sm ml-2">
                                    (+{purchase.bonus_credits} bonus)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {formatCurrency(
                                purchase.amount_paid,
                                purchase.currency || "INR"
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center">
                                {purchase.status === "completed" ? (
                                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                                ) : purchase.status === "pending" ? (
                                  <Clock className="w-4 h-4 text-yellow-400 mr-2" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-400 mr-2" />
                                )}
                                <span className="capitalize">
                                  {purchase.status}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {purchase.status === "completed" && (
                                <button
                                  onClick={() => downloadInvoice(purchase.id)}
                                  className="flex items-center px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Invoice
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Credit Purchase Modal */}
        <CreditPurchaseModal
          isOpen={isCreditModalOpen}
          onClose={() => setIsCreditModalOpen(false)}
          onPurchase={handlePurchaseSuccess}
          selectedCurrency={selectedCurrency}
        />
      </div>
    </div>
  );
};

export default BillingPage;
