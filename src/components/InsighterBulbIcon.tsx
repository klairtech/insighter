"use client";

import Image from "next/image";
import { useState } from "react";

interface InsighterBulbIconProps {
  size?: number;
  className?: string;
  alt?: string;
}

export default function InsighterBulbIcon({
  size = 32,
  className = "",
  alt = "Insighter Bulb Icon",
}: InsighterBulbIconProps) {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    // Fallback to a simple bulb icon if the image fails to load
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-white"
        >
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zM9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1z"
            fill="currentColor"
          />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src="https://uvbtwtqmtsbdwmcrtdcx.supabase.co/storage/v1/object/public/website/public/Logos/Insighter/White/Insighter%20Bulb%20Logo%20White%202%20Cropped.png"
      alt={alt}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={() => setImageError(true)}
      priority
    />
  );
}
