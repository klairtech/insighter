import { Metadata } from 'next'

export interface SEOConfig {
  title: string
  description: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'product'
  publishedTime?: string
  modifiedTime?: string
  author?: string
  section?: string
  tags?: string[]
}

export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    image = '/og-image.jpg',
    url,
    type = 'website',
    publishedTime,
    modifiedTime,
    author = 'Insighter Team',
    section,
    tags = []
  } = config

  const fullTitle = title.includes('Insighter') ? title : `${title} | Insighter`
  const fullDescription = description.length > 160 ? description.substring(0, 157) + '...' : description
  const fullKeywords = ['Insighter', 'AI', 'Data Analytics', 'Business Intelligence', ...keywords].join(', ')

  return {
    title: fullTitle,
    description: fullDescription,
    keywords: fullKeywords,
    authors: [{ name: author }],
    creator: author,
    publisher: 'Insighter',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: type === 'product' ? 'website' : type,
      locale: 'en_US',
      url: url || 'https://insighter.co.in',
      title: fullTitle,
      description: fullDescription,
      siteName: 'Insighter',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(section && { section }),
      ...(tags.length > 0 && { tags }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      images: [image],
      creator: '@insighter_ai',
      site: '@insighter_ai',
    },
    alternates: {
      canonical: url || 'https://insighter.co.in',
    },
    other: {
      'application-name': 'Insighter',
      'apple-mobile-web-app-title': 'Insighter',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
      'format-detection': 'telephone=no',
      'mobile-web-app-capable': 'yes',
      'msapplication-TileColor': '#1f2937',
      'msapplication-config': '/browserconfig.xml',
      'theme-color': '#1f2937',
    },
  }
}

// Structured Data for Organization
export function generateOrganizationStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Insighter',
    url: 'https://insighter.co.in',
    logo: 'https://insighter.co.in/logo.svg',
    description: 'AI-powered data analytics platform that connects databases, processes files, and provides insights through natural language conversations.',
    foundingDate: '2024',
    sameAs: [
      'https://twitter.com/insighter_ai',
      'https://linkedin.com/company/insighter',
      'https://github.com/insighter',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'support@insighter.co.in',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
    },
  }
}

// Structured Data for Software Application
export function generateSoftwareApplicationStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Insighter',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    description: 'AI-powered data analytics platform for business intelligence and data insights.',
    url: 'https://insighter.co.in',
    author: {
      '@type': 'Organization',
      name: 'Insighter',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
    },
    screenshot: 'https://insighter.co.in/screenshot.jpg',
  }
}

// Structured Data for WebPage
export function generateWebPageStructuredData(pageConfig: {
  title: string
  description: string
  url: string
  breadcrumbs?: Array<{ name: string; url: string }>
}) {
  const { title, description, url, breadcrumbs = [] } = pageConfig

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Insighter',
      url: 'https://insighter.co.in',
    },
    ...(breadcrumbs.length > 0 && {
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      },
    }),
  }
}

// FAQ Structured Data
export function generateFAQStructuredData(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
