"use client";

import { useEffect, useState } from "react";

export type NotificationType = "success" | "error" | "info" | "warning";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
  onConfirm?: () => void;
  confirmText?: string;
  showCancel?: boolean;
  cancelText?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export default function NotificationModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  details,
  onConfirm,
  confirmText = "OK",
  showCancel = false,
  cancelText = "Cancel",
  autoClose = false,
  autoCloseDelay = 3000,
}: NotificationModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowAnimation(true);

      if (autoClose) {
        const timer = setTimeout(() => {
          onClose();
        }, autoCloseDelay);

        return () => clearTimeout(timer);
      }
    } else {
      setShowAnimation(false);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          headerBg: "bg-gradient-to-r from-green-600 to-green-700",
          iconBg: "bg-green-100",
          iconColor: "text-green-600",
          icon: (
            <svg
              className="w-8 h-8"
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
          ),
        };
      case "error":
        return {
          headerBg: "bg-gradient-to-r from-red-600 to-red-700",
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
          icon: (
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ),
        };
      case "warning":
        return {
          headerBg: "bg-gradient-to-r from-yellow-600 to-yellow-700",
          iconBg: "bg-yellow-100",
          iconColor: "text-yellow-600",
          icon: (
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          ),
        };
      case "info":
      default:
        return {
          headerBg: "bg-gradient-to-r from-blue-600 to-blue-700",
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
          icon: (
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-300 ${
          showAnimation ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className={`${styles.headerBg} px-6 py-4`}>
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 ${styles.iconBg} rounded-lg flex items-center justify-center`}
            >
              <div className={styles.iconColor}>{styles.icon}</div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{title}</h2>
              <p className="text-sm text-white/80">
                {type === "success"
                  ? "Operation completed"
                  : type === "error"
                  ? "An error occurred"
                  : type === "warning"
                  ? "Please review"
                  : "Information"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center">
            <div
              className={`w-16 h-16 ${
                styles.iconBg
              } rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-500 ${
                showAnimation ? "scale-110 shadow-lg" : "scale-100"
              }`}
            >
              <div className={styles.iconColor}>{styles.icon}</div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-2">{message}</h3>

            {details && <p className="text-gray-300 text-sm mb-4">{details}</p>}

            <div className="space-y-3">
              {onConfirm && (
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`w-full px-4 py-2 ${
                    type === "success"
                      ? "bg-green-600 hover:bg-green-700"
                      : type === "error"
                      ? "bg-red-600 hover:bg-red-700"
                      : type === "warning"
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white rounded-lg transition-colors`}
                >
                  {confirmText}
                </button>
              )}

              {showCancel && (
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  {cancelText}
                </button>
              )}

              {!onConfirm && !showCancel && (
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  {confirmText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
