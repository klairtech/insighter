"use client";

import {
  generateOrganizationStructuredData,
  generateSoftwareApplicationStructuredData,
} from "@/lib/seo";

export default function StructuredData() {
  const organizationData = generateOrganizationStructuredData();
  const softwareData = generateSoftwareApplicationStructuredData();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationData),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareData),
        }}
      />
    </>
  );
}
