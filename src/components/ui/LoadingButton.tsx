"use client";

import React, { useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContext";

interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loadingKey?: string;
  loadingText?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export default function LoadingButton({
  loadingKey,
  loadingText = "Loading...",
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  disabled,
  onClick,
  ...props
}: LoadingButtonProps) {
  const { isLoading } = useLoading();
  const isButtonLoading = loadingKey ? isLoading(loadingKey) : false;
  const isDisabled = disabled || isButtonLoading;

  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost:
      "bg-transparent text-gray-300 hover:text-white hover:bg-white/10 focus:ring-gray-500",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const widthClasses = fullWidth ? "w-full" : "";

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClasses} ${className}`;

  return (
    <button
      className={classes}
      disabled={isDisabled}
      onClick={onClick}
      {...props}
    >
      {isButtonLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Loading Link component for navigation
interface LoadingLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  loadingKey?: string;
  loadingText?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  router?: any;
}

export function LoadingLink({
  href,
  loadingKey,
  loadingText = "Loading...",
  children,
  variant = "ghost",
  size = "md",
  fullWidth = false,
  className = "",
  router,
  onClick,
  ...props
}: LoadingLinkProps) {
  const { isLoading, startLoading, stopLoading, clearAllLoading } =
    useLoading();
  const loadingKeyFinal = loadingKey || `navigation-${href}`;
  const isLinkLoading = isLoading(loadingKeyFinal);

  // Cleanup loading state when component unmounts (page changes)
  useEffect(() => {
    return () => {
      // Stop loading when component unmounts
      stopLoading(loadingKeyFinal);
    };
  }, [loadingKeyFinal, stopLoading]);

  // Add a timeout to automatically clear loading state if it gets stuck
  useEffect(() => {
    if (isLinkLoading) {
      const timeout = setTimeout(() => {
        stopLoading(loadingKeyFinal);
      }, 3000); // Clear loading after 3 seconds
      return () => clearTimeout(timeout);
    }
  }, [isLinkLoading, loadingKeyFinal, stopLoading]);

  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500",
    ghost:
      "bg-transparent text-gray-300 hover:text-white hover:bg-white/10 focus:ring-gray-500",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const widthClasses = fullWidth ? "w-full" : "";

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClasses} ${className}`;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }

    if (router && !e.defaultPrevented) {
      e.preventDefault();
      startLoading(loadingKeyFinal);
      router.push(href);
    }
  };

  return (
    <a href={href} className={classes} onClick={handleClick} {...props}>
      {isLinkLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </a>
  );
}
