'use client';

import { useCallback } from 'react';
import { analytics, setUserProperties } from '@/lib/analytics';

/**
 * Custom hook for analytics tracking
 * Provides easy access to analytics functions throughout the app
 */
export function useAnalytics() {
  // User authentication tracking
  const trackLogin = useCallback((method: string = 'email') => {
    analytics.login(method);
  }, []);

  const trackSignup = useCallback((method: string = 'email') => {
    analytics.signup(method);
  }, []);

  const trackLogout = useCallback(() => {
    analytics.logout();
  }, []);

  // Workspace tracking
  const trackCreateWorkspace = useCallback((workspaceName: string) => {
    analytics.createWorkspace(workspaceName);
  }, []);

  const trackJoinWorkspace = useCallback((workspaceId: string) => {
    analytics.joinWorkspace(workspaceId);
  }, []);

  // Chat and AI tracking
  const trackStartChat = useCallback((workspaceId: string) => {
    analytics.startChat(workspaceId);
  }, []);

  const trackSendMessage = useCallback((messageLength: number, hasAttachments: boolean = false) => {
    analytics.sendMessage(messageLength, hasAttachments);
  }, []);

  const trackAIResponse = useCallback((responseTime: number, model: string) => {
    analytics.aiResponse(responseTime, model);
  }, []);

  // Data source tracking
  const trackConnectDataSource = useCallback((sourceType: string) => {
    analytics.connectDataSource(sourceType);
  }, []);

  const trackExecuteQuery = useCallback((queryType: string, executionTime: number) => {
    analytics.executeQuery(queryType, executionTime);
  }, []);

  // File operations tracking
  const trackUploadFile = useCallback((fileType: string, fileSize: number) => {
    analytics.uploadFile(fileType, fileSize);
  }, []);

  const trackDownloadFile = useCallback((fileType: string) => {
    analytics.downloadFile(fileType);
  }, []);

  // Billing tracking
  const trackViewPricing = useCallback(() => {
    analytics.viewPricing();
  }, []);

  const trackStartSubscription = useCallback((planType: string, amount: number) => {
    analytics.startSubscription(planType, amount);
  }, []);

  const trackPurchaseSubscription = useCallback((planType: string, amount: number, transactionId: string) => {
    analytics.purchaseSubscription(planType, amount, transactionId);
  }, []);

  // Error tracking
  const trackError = useCallback((errorType: string, errorMessage: string, context?: string) => {
    analytics.error(errorType, errorMessage, context);
  }, []);

  // Performance tracking
  const trackPageLoad = useCallback((loadTime: number) => {
    analytics.pageLoad(loadTime);
  }, []);

  // Feature usage tracking
  const trackFeatureUsage = useCallback((featureName: string, context?: Record<string, unknown>) => {
    analytics.useFeature(featureName, context);
  }, []);

  // Search tracking
  const trackSearch = useCallback((searchTerm: string, resultsCount: number) => {
    analytics.search(searchTerm, resultsCount);
  }, []);

  // Share tracking
  const trackShare = useCallback((contentType: string, method: string) => {
    analytics.shareContent(contentType, method);
  }, []);

  // User properties
  const setUserProps = useCallback((properties: Record<string, unknown>) => {
    setUserProperties(properties);
  }, []);

  // Generic event tracking
  const trackEvent = useCallback((eventName: string, parameters?: Record<string, unknown>) => {
    analytics.useFeature(eventName, parameters);
  }, []);

  return {
    // Authentication
    trackLogin,
    trackSignup,
    trackLogout,
    
    // Workspace
    trackCreateWorkspace,
    trackJoinWorkspace,
    
    // Chat & AI
    trackStartChat,
    trackSendMessage,
    trackAIResponse,
    
    // Data sources
    trackConnectDataSource,
    trackExecuteQuery,
    
    // Files
    trackUploadFile,
    trackDownloadFile,
    
    // Billing
    trackViewPricing,
    trackStartSubscription,
    trackPurchaseSubscription,
    
    // System
    trackError,
    trackPageLoad,
    trackFeatureUsage,
    trackSearch,
    trackShare,
    
    // Utilities
    setUserProps,
    trackEvent,
  };
}
