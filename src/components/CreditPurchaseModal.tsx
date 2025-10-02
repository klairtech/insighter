"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import PaymentStatusModal from "./PaymentStatusModal";
import {
  parseRazorpayError,
  parsePaymentVerificationError,
  logPaymentError,
  type PaymentError,
} from "@/lib/payment-error-handler";
import {
  calculateCreditPricing,
  formatCurrency,
  type SupportedCurrency,
} from "@/lib/pricing-utils";
import { useAnalytics } from "@/hooks/useAnalytics";

// Declare Razorpay types
interface RazorpayInstance {
  open(): void;
  on(event: string, callback: (response: RazorpayResponse) => void): void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
}

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (credits: number) => Promise<void>;
  selectedCurrency?: SupportedCurrency;
}

const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchase,
  selectedCurrency = "INR",
}) => {
  const [selectedCredits, setSelectedCredits] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "success" | "failed" | "timeout" | "cancelled"
  >("idle");
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<{
    credits?: number;
    amount?: string;
    currency?: string;
  }>({});

  const { trackStartSubscription, trackPurchaseSubscription, trackError } =
    useAnalytics();

  if (!isOpen) return null;

  // Generate credit options dynamically based on selected currency
  const creditOptions = [100, 200, 500, 1000, 2000, 5000].map((credits) => {
    const pricing = calculateCreditPricing(credits, selectedCurrency);
    return {
      credits,
      price: pricing.finalAmount / 100, // Convert from smallest unit to display format
      priceInr: pricing.basePriceInr / 100, // Convert from paise to rupees
      bonus: pricing.bonusCredits,
      currency: pricing.finalCurrency,
    };
  });

  const selectedOption = creditOptions.find(
    (opt) => opt.credits === selectedCredits
  );

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      // Check if Razorpay is already loaded
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        resolve(false);
      }, 10000); // 10 second timeout

      script.onload = () => {
        clearTimeout(timeout);
        // Note: CORS errors from Sentry CDN are expected and don't affect payment functionality
        resolve(true);
      };

      script.onerror = (error) => {
        clearTimeout(timeout);
        console.error("❌ Failed to load Razorpay script:", error);
        resolve(false);
      };

      document.body.appendChild(script);
    });
  };

  const handlePurchase = async () => {
    if (!selectedOption) return;

    // Track credit purchase start
    trackStartSubscription("credits", selectedOption.price);

    setIsLoading(true);
    setPaymentStatus("processing");
    setPaymentError(null);

    try {
      // Load Razorpay script with retry mechanism
      let razorpayLoaded = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!razorpayLoaded && retryCount < maxRetries) {
        const res = await loadRazorpayScript();
        if (res) {
          razorpayLoaded = true;
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retryCount)
            ); // Exponential backoff
          }
        }
      }

      if (!razorpayLoaded) {
        const error = parseRazorpayError({
          message: `Razorpay SDK failed to load after ${maxRetries} attempts. Please check your internet connection and try again.`,
        });
        setPaymentError(error);
        setPaymentStatus("failed");
        logPaymentError(error, "sdk-load-retry-failed", { retryCount });

        // Track payment error
        trackError("payment_sdk_load_failed", error.message, "credit_purchase");
        return;
      }

      // Create order
      const orderResponse = await fetch("/api/credits/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credits: selectedOption.credits }),
      });

      const orderData = await orderResponse.json();
      if (!orderResponse.ok) {
        const error = parseRazorpayError({
          message: orderData.error || "Failed to create order",
        });
        setPaymentError(error);
        setPaymentStatus("failed");
        logPaymentError(error, "create-order", orderData);
        return;
      }

      // Store payment details for status modal
      setPaymentDetails({
        credits: orderData.credits.total,
        amount: (orderData.order.amount / 100).toFixed(2),
        currency: orderData.order.currency,
      });

      // Razorpay options
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Insighter",
        description: `Purchase ${orderData.credits.total} credits`,
        image:
          "https://uvbtwtqmtsbdwmcrtdcx.supabase.co/storage/v1/object/public/website/public/Logos/Insighter/Insighter%20Logos%20(svg)/logo.svg",
        order_id: orderData.order.id,
        handler: async function (response: RazorpayResponse) {
          try {
            // Verify payment and complete purchase

            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
                  credits: orderData.credits.base,
                  bonus_credits: orderData.credits.bonus,
                  total_credits: orderData.credits.total,
                  amount_paid: orderData.order.amount,
                  currency: orderData.order.currency,
                }),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              let purchaseData;
              try {
                purchaseData = await purchaseResponse.json();
              } catch (jsonError) {
                console.error("Failed to parse response JSON:", jsonError);
                purchaseData = { error: "Invalid response from server" };
              }

              if (!purchaseResponse.ok) {
                console.error("Payment verification failed:", {
                  status: purchaseResponse.status,
                  statusText: purchaseResponse.statusText,
                  purchaseData,
                });

                const error = parsePaymentVerificationError({
                  message:
                    purchaseData?.error ||
                    `Purchase failed (${purchaseResponse.status})`,
                  code: purchaseData?.code || "PURCHASE_FAILED",
                  status: purchaseResponse.status,
                });
                setPaymentError(error);
                setPaymentStatus("failed");
                logPaymentError(error, "payment-verification", {
                  purchaseData,
                  responseStatus: purchaseResponse.status,
                  responseStatusText: purchaseResponse.statusText,
                  rawResponse: purchaseData,
                });
                return;
              }

              // Payment successful
              setPaymentStatus("success");

              // Track successful purchase
              trackPurchaseSubscription(
                "credits",
                selectedOption.price,
                `credit_purchase_${selectedOption.credits}`
              );

              await onPurchase(selectedOption.credits);
            } catch (fetchError) {
              clearTimeout(timeoutId);
              if (
                fetchError instanceof Error &&
                fetchError.name === "AbortError"
              ) {
                console.error(
                  "⏰ Payment verification timed out after 30 seconds"
                );
                setPaymentError({
                  code: "TIMEOUT_ERROR",
                  message:
                    "Payment verification timed out. Please check your credits.",
                  type: "failed",
                  retryable: true,
                });
              } else {
                console.error(
                  "🌐 Network error during payment verification:",
                  fetchError
                );
                setPaymentError({
                  code: "NETWORK_ERROR",
                  message:
                    "Network error during payment verification. Please try again.",
                  type: "failed",
                  retryable: true,
                });
              }
              setPaymentStatus("failed");
              return;
            }
          } catch (error) {
            console.error("Payment verification catch block error:", error);
            const parsedError = parsePaymentVerificationError({
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
              code: "NETWORK_ERROR",
              status: 0,
            });
            setPaymentError(parsedError);
            setPaymentStatus("failed");
            logPaymentError(parsedError, "payment-verification", {
              originalError: error,
              errorType: typeof error,
              errorString: String(error),
            });
          }
        },
        prefill: {
          name: "User",
          email: "user@example.com",
        },
        theme: {
          color: "#3B82F6",
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false);
            setPaymentStatus("cancelled");
          },
        },
      };


      // Verify Razorpay instance
      if (!window.Razorpay) {
        throw new Error("Razorpay not available");
      }

      const razorpay = new window.Razorpay(options);

      // Add error handler
      razorpay.on("payment.failed", function (response: unknown) {
        console.error("❌ Razorpay payment failed:", response);
        setPaymentStatus("failed");
        setPaymentError({
          code: "PAYMENT_FAILED",
          message: "Payment failed. Please try again.",
          type: "failed",
          retryable: true,
        });
      });

      razorpay.open();
    } catch (error) {
      const parsedError = parseRazorpayError(error);
      setPaymentError(parsedError);
      setPaymentStatus("failed");
      logPaymentError(parsedError, "purchase-flow", { originalError: error });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Payment Status Modal */}
      <PaymentStatusModal
        isOpen={paymentStatus !== "idle"}
        onClose={() => {
          setPaymentStatus("idle");
          setPaymentError(null);
          if (paymentStatus === "success") {
            onClose();
          }
        }}
        status={paymentStatus === "idle" ? "processing" : paymentStatus}
        error={paymentError || undefined}
        credits={paymentDetails.credits}
        amount={paymentDetails.amount}
        currency={paymentDetails.currency}
        onRetry={() => {
          setPaymentStatus("idle");
          setPaymentError(null);
          handlePurchase();
        }}
        onContactSupport={() => {
          // Open support contact
          window.open(
            "mailto:support@insighter.com?subject=Payment Issue",
            "_blank"
          );
        }}
      />

      {/* Main Purchase Modal */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Buy Credits</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-300 mb-6">
              Choose how many credits you want to purchase. You&apos;ll get 5%
              bonus credits for every 100 credits!
            </p>

            {/* Credit Options */}
            <div className="space-y-3 mb-6">
              {creditOptions.map((option) => (
                <div
                  key={option.credits}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedCredits === option.credits
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                  onClick={() => setSelectedCredits(option.credits)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white font-medium">
                        {option.credits} credits
                      </div>
                      <div className="text-sm text-gray-400">
                        +{option.bonus} bonus credits
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">
                        {formatCurrency(option.price * 100, option.currency)}
                      </div>
                      <div className="text-sm text-gray-400">
                        ₹{option.priceInr}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Option Summary */}
            {selectedOption && (
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <h3 className="text-white font-medium mb-2">
                  Purchase Summary
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>Base Credits:</span>
                    <span>{selectedOption.credits}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Bonus Credits:</span>
                    <span className="text-green-400">
                      +{selectedOption.bonus}
                    </span>
                  </div>
                  <div className="flex justify-between text-white font-medium border-t border-gray-700 pt-2">
                    <span>Total Credits:</span>
                    <span>{selectedOption.credits + selectedOption.bonus}</span>
                  </div>
                  <div className="flex justify-between text-white font-medium">
                    <span>Total Price:</span>
                    <span>
                      {formatCurrency(
                        selectedOption.price * 100,
                        selectedOption.currency
                      )}{" "}
                      / ₹{selectedOption.priceInr}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Purchase Button */}
            <button
              onClick={handlePurchase}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isLoading ? "Processing..." : "Purchase Credits"}
            </button>

            {/* Terms */}
            <p className="text-xs text-gray-400 mt-4 text-center">
              Credits expire after 1 year. All features included with purchase.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreditPurchaseModal;
