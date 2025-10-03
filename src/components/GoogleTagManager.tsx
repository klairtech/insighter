"use client";

import Script from "next/script";
import { GTM_ID, isValidGTMId } from "@/lib/analytics";

/**
 * Google Tag Manager Component
 * Renders GTM scripts in the document head and body
 */
export default function GoogleTagManager() {
  // Validate GTM ID format
  if (!GTM_ID || !isValidGTMId(GTM_ID)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "GTM_ID is missing or invalid. Please set NEXT_PUBLIC_GTM_ID environment variable."
      );
    }
    return null;
  }

  return (
    <>
      {/* GTM Script in head */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `,
        }}
      />
      {/* Initialize dataLayer */}
      <Script
        id="gtm-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
          `,
        }}
      />
    </>
  );
}

/**
 * Google Tag Manager NoScript Component
 * Renders GTM noscript fallback in the body
 */
export function GoogleTagManagerNoScript() {
  if (!GTM_ID || !isValidGTMId(GTM_ID)) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
