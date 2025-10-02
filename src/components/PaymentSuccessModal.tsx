import React from "react";

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  credits: number;
  isAnnual: boolean;
}

const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  planName,
  credits,
  isAnnual,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          {/* Success Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Success Message */}
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Payment Successful!
          </h3>

          <p className="text-gray-600 mb-6">
            Successfully subscribed to{" "}
            <span className="font-semibold text-blue-600">{planName}</span>{" "}
            plan!
            <br />
            You now have{" "}
            <span className="font-semibold text-green-600">
              {credits.toLocaleString()}
            </span>{" "}
            credits.
            {isAnnual && (
              <span className="block mt-2 text-sm text-blue-600">
                🎉 You saved 20% with annual billing!
              </span>
            )}
          </p>

          {/* Features */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-900 mb-2">
              What&apos;s included:
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {credits.toLocaleString()} credits per month</li>
              <li>• Priority support</li>
              <li>• Fastest processing speed</li>
              <li>• All premium features</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue to Dashboard
            </button>
            <button
              onClick={() => {
                onClose();
                window.location.href = "/profile";
              }}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              View Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;
