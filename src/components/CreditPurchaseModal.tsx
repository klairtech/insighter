"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

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
}

const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchase,
}) => {
  const [selectedCredits, setSelectedCredits] = useState(100);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const creditOptions = [
    { credits: 100, price: 1.19, priceInr: 99, bonus: 5 },
    { credits: 200, price: 2.38, priceInr: 198, bonus: 10 },
    { credits: 500, price: 5.95, priceInr: 495, bonus: 25 },
    { credits: 1000, price: 11.9, priceInr: 990, bonus: 50 },
    { credits: 2000, price: 23.8, priceInr: 1980, bonus: 100 },
    { credits: 5000, price: 59.5, priceInr: 4950, bonus: 250 },
  ];

  const selectedOption = creditOptions.find(
    (opt) => opt.credits === selectedCredits
  );

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePurchase = async () => {
    if (!selectedOption) return;

    setIsLoading(true);
    try {
      // Load Razorpay script
      const res = await loadRazorpayScript();
      if (!res) {
        throw new Error("Razorpay SDK failed to load");
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
        throw new Error(orderData.error || "Failed to create order");
      }

      // Razorpay options
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Insighter",
        description: `Purchase ${orderData.credits.total} credits`,
        image: "/logo.svg",
        order_id: orderData.order.id,
        handler: async function (response: RazorpayResponse) {
          try {
            // Verify payment and complete purchase
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
              }),
            });

            const purchaseData = await purchaseResponse.json();
            if (!purchaseResponse.ok) {
              throw new Error(purchaseData.error || "Purchase failed");
            }

            // Call the original onPurchase callback for UI updates
            await onPurchase(selectedOption.credits);
            onClose();
          } catch (error) {
            console.error("Payment verification failed:", error);
            alert("Payment verification failed. Please contact support.");
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
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error("Purchase failed:", error);
      alert("Purchase failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
                      ${option.price}
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
              <h3 className="text-white font-medium mb-2">Purchase Summary</h3>
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
                    ${selectedOption.price} / ₹{selectedOption.priceInr}
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
  );
};

export default CreditPurchaseModal;
