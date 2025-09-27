"use client";

import { useState, useCallback } from "react";
import { NotificationType } from "@/components/NotificationModal";

interface NotificationState {
  isOpen: boolean;
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

export function useNotification() {
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const showNotification = useCallback((config: Omit<NotificationState, "isOpen">) => {
    setNotification({
      ...config,
      isOpen: true,
    });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Convenience methods for different notification types
  const showSuccess = useCallback((title: string, message: string, details?: string, options?: Partial<NotificationState>) => {
    showNotification({
      type: "success",
      title,
      message,
      details,
      autoClose: true,
      autoCloseDelay: 3000,
      ...options,
    });
  }, [showNotification]);

  const showError = useCallback((title: string, message: string, details?: string, options?: Partial<NotificationState>) => {
    showNotification({
      type: "error",
      title,
      message,
      details,
      ...options,
    });
  }, [showNotification]);

  const showWarning = useCallback((title: string, message: string, details?: string, options?: Partial<NotificationState>) => {
    showNotification({
      type: "warning",
      title,
      message,
      details,
      autoClose: true,
      autoCloseDelay: 4000,
      ...options,
    });
  }, [showNotification]);

  const showInfo = useCallback((title: string, message: string, details?: string, options?: Partial<NotificationState>) => {
    showNotification({
      type: "info",
      title,
      message,
      details,
      autoClose: true,
      autoCloseDelay: 3000,
      ...options,
    });
  }, [showNotification]);

  return {
    notification,
    showNotification,
    hideNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
