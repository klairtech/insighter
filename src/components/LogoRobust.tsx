"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface LogoRobustProps {
  variant?: "default" | "white" | "blue";
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  showText?: boolean;
  className?: string;
}

export default function LogoRobust({
  variant = "default",
  size = "md",
  showText = true,
  className = "",
}: LogoRobustProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [useInline, setUseInline] = useState(false);

  const getLogoSrc = useCallback(() => {
    switch (variant) {
      case "white":
        return "https://uvbtwtqmtsbdwmcrtdcx.supabase.co/storage/v1/object/public/website/public/Logos/Insighter/Insighter%20Logos%20(svg)/logo-white.svg";
      case "blue":
        return "https://uvbtwtqmtsbdwmcrtdcx.supabase.co/storage/v1/object/public/website/public/Logos/Insighter/Insighter%20Logos%20(svg)/logo-blue.svg";
      default:
        return "https://uvbtwtqmtsbdwmcrtdcx.supabase.co/storage/v1/object/public/website/public/Logos/Insighter/Insighter%20Logos%20(svg)/logo.svg";
    }
  }, [variant]);

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "w-6 h-6";
      case "lg":
        return "w-12 h-12";
      case "xl":
        return "w-16 h-16";
      case "2xl":
        return "w-20 h-20";
      default:
        return "w-8 h-8";
    }
  };

  const getTextSize = () => {
    switch (size) {
      case "sm":
        return "text-lg";
      case "lg":
        return "text-2xl";
      case "xl":
        return "text-3xl";
      case "2xl":
        return "text-4xl";
      default:
        return "text-xl";
    }
  };

  // Try to load the image first
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      setImageLoading(false);
      // Only log in development
      // if (process.env.NODE_ENV === "development") {
      //   console.log(`Logo loaded successfully: ${getLogoSrc()}`);
      // }
    };
    img.onerror = () => {
      // Only log in development and only once per variant
      // if (process.env.NODE_ENV === "development") {
      //   console.warn(`Logo file not found, using fallback: ${getLogoSrc()}`);
      // }
      setImageError(true);
      setUseInline(true);
      setImageLoading(false);
    };
    // Add a small delay to prevent race conditions
    const timer = setTimeout(() => {
      img.src = getLogoSrc();
    }, 100);

    return () => clearTimeout(timer);
  }, [variant, getLogoSrc]);

  // If image fails, use inline SVG
  if (useInline || imageError) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className={`${getSizeClasses()} relative`}>
          <svg
            viewBox="0 0 200 60"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="bulbGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#4FD1C5" />
                <stop offset="100%" stopColor="#3182CE" />
              </linearGradient>
              <linearGradient
                id="textGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#3182CE" />
                <stop offset="100%" stopColor="#4FD1C5" />
              </linearGradient>
            </defs>

            {/* Lightbulb Body */}
            <path
              d="M30 5C20.717 5 13 12.717 13 22c0 6.627 4.243 12.31 10.18 14.732L23 40h14l-0.18 -3.268C42.757 34.31 47 28.627 47 22c0-9.283-7.717-17-17-17z"
              fill="url(#bulbGradient)"
            />

            {/* Lightbulb Base */}
            <rect x="25" y="40" width="10" height="3" rx="1.5" fill="#3182CE" />
            <rect x="23" y="44" width="14" height="3" rx="1.5" fill="#3182CE" />
            <rect x="21" y="48" width="18" height="3" rx="1.5" fill="#3182CE" />

            {/* Light Rays */}
            <path
              d="M25 2C25 2 26 0 30 0C34 0 35 2 35 2"
              stroke="#4FD1C5"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M20 5L18 3M40 5L42 3"
              stroke="#4FD1C5"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M15 10L13 8M45 10L47 8"
              stroke="#4FD1C5"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Bar Chart inside bulb */}
            <rect x="20" y="28" width="4" height="6" rx="1" fill="#2C7A7B" />
            <rect x="26" y="25" width="4" height="9" rx="1" fill="#2C7A7B" />
            <rect x="32" y="22" width="4" height="12" rx="1" fill="#2C7A7B" />

            {/* Line Graph inside bulb */}
            <path
              d="M20 20L25 18L30 21L35 17"
              stroke="#000000"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="20" cy="20" r="1.5" fill="#000000" />
            <circle cx="25" cy="18" r="1.5" fill="#000000" />
            <circle cx="30" cy="21" r="1.5" fill="#000000" />
            <circle cx="35" cy="17" r="1.5" fill="#000000" />
          </svg>
        </div>
      </div>
    );
  }

  // If still loading, show loading state
  if (imageLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${getSizeClasses()} relative`}>
          <div className="w-full h-full bg-primary-500 rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        {showText && (
          <span
            className={`font-google-sans font-bold text-foreground ${getTextSize()}`}
          >
            Insighter
          </span>
        )}
      </div>
    );
  }

  // Try regular img tag
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${getSizeClasses()} relative`}>
        <Image
          src={getLogoSrc()}
          alt="Insighter - AI-Powered Data Analytics Platform"
          width={200}
          height={60}
          className="w-full h-full object-contain"
          onError={() => {
            if (process.env.NODE_ENV === "development") {
              console.warn(
                `Final fallback: img tag failed for ${getLogoSrc()}`
              );
            }
            setImageError(true);
          }}
          style={{
            filter:
              variant === "white"
                ? "brightness(0) invert(1)"
                : variant === "blue"
                ? "brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)"
                : "none",
          }}
        />
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 200 60"
              className="w-full h-full"
              fill={
                variant === "white"
                  ? "white"
                  : variant === "blue"
                  ? "#4285f4"
                  : "#0f1419"
              }
            >
              <rect
                x="10"
                y="10"
                width="40"
                height="40"
                rx="8"
                fill="currentColor"
              />
              <text
                x="60"
                y="35"
                fontSize="20"
                fontWeight="bold"
                fill="currentColor"
              >
                I
              </text>
            </svg>
          </div>
        )}
      </div>
      {showText && (
        <span
          className={`font-google-sans font-bold text-foreground ${getTextSize()}`}
        >
          Insighter
        </span>
      )}
    </div>
  );
}
