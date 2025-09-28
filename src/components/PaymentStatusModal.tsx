"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  X,
  CreditCard,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  PaymentError,
  getErrorMessage,
  getRetryDelay,
  shouldRetry,
} from "@/lib/payment-error-handler";

interface PaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: "processing" | "success" | "failed" | "timeout" | "cancelled";
  error?: PaymentError;
  credits?: number;
  amount?: string;
  currency?: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
}

const PaymentStatusModal: React.FC<PaymentStatusModalProps> = ({
  isOpen,
  onClose,
  status,
  error,
  credits,
  amount,
  currency,
  onRetry,
  onContactSupport,
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const [retryDelay, setRetryDelay] = useState(0);

  useEffect(() => {
    if (error) {
      setCanRetry(shouldRetry(error, retryCount));
      setRetryDelay(getRetryDelay(error));
    }
  }, [error, retryCount]);

  useEffect(() => {
    if (retryDelay > 0) {
      const timer = setTimeout(() => {
        setRetryDelay((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [retryDelay]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    onRetry?.();
  };

  const getStatusIcon = () => {
    switch (status) {
      case "processing":
        return <Clock className="w-16 h-16 text-blue-500 animate-spin" />;
      case "success":
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case "failed":
        return <XCircle className="w-16 h-16 text-red-500" />;
      case "timeout":
        return <AlertTriangle className="w-16 h-16 text-yellow-500" />;
      case "cancelled":
        return <X className="w-16 h-16 text-gray-500" />;
      default:
        return <AlertTriangle className="w-16 h-16 text-gray-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case "processing":
        return "Processing Payment...";
      case "success":
        return "Payment Successful!";
      case "failed":
        return "Payment Failed";
      case "timeout":
        return "Payment Timeout";
      case "cancelled":
        return "Payment Cancelled";
      default:
        return "Payment Status";
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case "processing":
        return "Please wait while we process your payment. Do not close this window.";
      case "success":
        return `🎉 Successfully purchased ${credits} credits for ${amount} ${currency}!`;
      case "failed":
        return error
          ? getErrorMessage(error)
          : "Payment failed. Please try again.";
      case "timeout":
        return "Payment timed out. Your payment may still be processing. Please check your account or try again.";
      case "cancelled":
        return "Payment was cancelled. No charges have been made.";
      default:
        return "An unexpected error occurred.";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "processing":
        return "border-blue-500 bg-blue-50";
      case "success":
        return "border-green-500 bg-green-50";
      case "failed":
        return "border-red-500 bg-red-50";
      case "timeout":
        return "border-yellow-500 bg-yellow-50";
      case "cancelled":
        return "border-gray-500 bg-gray-50";
      default:
        return "border-gray-500 bg-gray-50";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-lg p-6 max-w-md w-full border-2 ${getStatusColor()}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {getStatusTitle()}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Icon and Message */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">{getStatusIcon()}</div>
          <p className="text-gray-700 text-sm">{getStatusMessage()}</p>
        </div>

        {/* Error Details */}
        {error && (
          <div className="mb-4 p-3 bg-gray-100 rounded-lg">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Error Details
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Code: {error.code} | Type: {error.type}
            </p>
            {error.retryable && (
              <p className="text-xs text-blue-600 mt-1">
                This error can be retried
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2">
          {status === "success" && (
            <button
              onClick={onClose}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              Continue
            </button>
          )}

          {(status === "failed" || status === "timeout") && canRetry && (
            <button
              onClick={handleRetry}
              disabled={retryDelay > 0}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {retryDelay > 0 ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Retry in {retryDelay}s
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </>
              )}
            </button>
          )}

          {(status === "failed" || status === "timeout") && (
            <button
              onClick={onContactSupport}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Contact Support
            </button>
          )}

          {status === "cancelled" && (
            <button
              onClick={onClose}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          )}

          {status === "processing" && (
            <div className="text-center">
              <div className="flex items-center justify-center text-blue-600">
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            </div>
          )}
        </div>

        {/* Network Status */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center text-xs text-gray-500">
            {navigator.onLine ? (
              <>
                <Wifi className="w-3 h-3 mr-1 text-green-500" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1 text-red-500" />
                Offline
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusModal;
