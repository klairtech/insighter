"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface LogoRobustProps {
  variant?: "default" | "white" | "blue";
  size?: "sm" | "md" | "lg";
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
        return "/logo-white.svg";
      case "blue":
        return "/logo-blue.svg";
      default:
        return "/logo.svg";
    }
  }, [variant]);

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "w-6 h-6";
      case "lg":
        return "w-12 h-12";
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
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${getSizeClasses()} relative`}>
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
