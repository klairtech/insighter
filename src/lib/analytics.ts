/**
 * Google Analytics and Google Tag Manager utilities
 * Handles tracking events, page views, and user interactions
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}

// Google Analytics Configuration
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

// Check if analytics is enabled
export const isAnalyticsEnabled = () => {
  return typeof window !== 'undefined' && (GA_MEASUREMENT_ID || GTM_ID);
};

// Initialize Google Analytics
export const initGA = () => {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;

  // Load gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_title: document.title,
    page_location: window.location.href,
  });
};

// Initialize Google Tag Manager
export const initGTM = () => {
  if (!GTM_ID || typeof window === 'undefined') return;

  // Load GTM script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js'
  });
};

// Track page views
export const trackPageView = (url: string, title?: string) => {
  if (!isAnalyticsEnabled()) return;

  // GA4 page view
  if (GA_MEASUREMENT_ID && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_title: title || document.title,
      page_location: url,
    });
  }

  // GTM page view
  if (GTM_ID && window.dataLayer) {
    // Ensure we have a valid URL for pathname extraction
    let pagePath = url;
    try {
      // If url is a full URL, extract pathname
      if (url.startsWith('http')) {
        pagePath = new URL(url).pathname;
      } else {
        // If url is just a path, use it as is
        pagePath = url;
      }
        } catch {
      // Fallback to the original url if URL construction fails
      pagePath = url;
    }

    window.dataLayer.push({
      event: 'page_view',
      page_title: title || document.title,
      page_location: window.location.href,
      page_path: pagePath,
    });
  }
};

// Track custom events
export const trackEvent = (
  eventName: string,
  parameters?: Record<string, unknown>
) => {
  if (!isAnalyticsEnabled()) return;

  // GA4 event
  if (GA_MEASUREMENT_ID && window.gtag) {
    window.gtag('event', eventName, parameters);
  }

  // GTM event
  if (GTM_ID && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...parameters,
    });
  }
};

// Predefined event tracking functions
export const analytics = {
  // User authentication events
  login: (method: string = 'email') => {
    trackEvent('login', { method });
  },

  signup: (method: string = 'email') => {
    trackEvent('sign_up', { method });
  },

  logout: () => {
    trackEvent('logout');
  },

  // Workspace events
  createWorkspace: (workspaceName: string) => {
    trackEvent('create_workspace', { workspace_name: workspaceName });
  },

  joinWorkspace: (workspaceId: string) => {
    trackEvent('join_workspace', { workspace_id: workspaceId });
  },

  // Chat and AI events
  startChat: (workspaceId: string) => {
    trackEvent('start_chat', { workspace_id: workspaceId });
  },

  sendMessage: (messageLength: number, hasAttachments: boolean = false) => {
    trackEvent('send_message', {
      message_length: messageLength,
      has_attachments: hasAttachments,
    });
  },

  aiResponse: (responseTime: number, model: string) => {
    trackEvent('ai_response', {
      response_time: responseTime,
      model_used: model,
    });
  },

  // Data source events
  connectDataSource: (sourceType: string) => {
    trackEvent('connect_data_source', { source_type: sourceType });
  },

  executeQuery: (queryType: string, executionTime: number) => {
    trackEvent('execute_query', {
      query_type: queryType,
      execution_time: executionTime,
    });
  },

  // File operations
  uploadFile: (fileType: string, fileSize: number) => {
    trackEvent('upload_file', {
      file_type: fileType,
      file_size: fileSize,
    });
  },

  downloadFile: (fileType: string) => {
    trackEvent('download_file', { file_type: fileType });
  },

  // Billing and subscription events
  viewPricing: () => {
    trackEvent('view_pricing');
  },

  startSubscription: (planType: string, amount: number) => {
    trackEvent('begin_checkout', {
      currency: 'USD',
      value: amount,
      plan_type: planType,
    });
  },

  purchaseSubscription: (planType: string, amount: number, transactionId: string) => {
    trackEvent('purchase', {
      transaction_id: transactionId,
      value: amount,
      currency: 'USD',
      plan_type: planType,
    });
  },

  // Error tracking
  error: (errorType: string, errorMessage: string, context?: string) => {
    trackEvent('error', {
      error_type: errorType,
      error_message: errorMessage,
      context: context,
    });
  },

  // Performance events
  pageLoad: (loadTime: number) => {
    trackEvent('page_load_time', { load_time: loadTime });
  },

  // Feature usage
  useFeature: (featureName: string, context?: Record<string, unknown>) => {
    trackEvent('feature_usage', {
      feature_name: featureName,
      ...context,
    });
  },

  // Search events
  search: (searchTerm: string, resultsCount: number) => {
    trackEvent('search', {
      search_term: searchTerm,
      results_count: resultsCount,
    });
  },

  // Share events
  shareContent: (contentType: string, method: string) => {
    trackEvent('share', {
      content_type: contentType,
      method: method,
    });
  },
};

// User properties
export const setUserProperties = (properties: Record<string, unknown>) => {
  if (!isAnalyticsEnabled()) return;

  if (GA_MEASUREMENT_ID && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      custom_map: properties,
    });
  }

  if (GTM_ID && window.dataLayer) {
    window.dataLayer.push({
      event: 'user_properties',
      ...properties,
    });
  }
};

// E-commerce tracking
export const trackPurchase = (
  transactionId: string,
  value: number,
  currency: string = 'USD',
  items: Array<{
    item_id: string;
    item_name: string;
    category: string;
    quantity: number;
    price: number;
  }>
) => {
  if (!isAnalyticsEnabled()) return;

  // GA4 purchase event
  if (GA_MEASUREMENT_ID && window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: transactionId,
      value: value,
      currency: currency,
      items: items,
    });
  }

  // GTM purchase event
  if (GTM_ID && window.dataLayer) {
    window.dataLayer.push({
      event: 'purchase',
      transaction_id: transactionId,
      value: value,
      currency: currency,
      items: items,
    });
  }
};

// Initialize analytics on client side
export const initializeAnalytics = () => {
  if (typeof window === 'undefined') return;

  // Initialize GA4
  if (GA_MEASUREMENT_ID) {
    initGA();
  }

  // Initialize GTM
  if (GTM_ID) {
    initGTM();
  }
};
