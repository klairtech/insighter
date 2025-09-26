"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { 
  PerformanceMonitor, 
  initializePerformanceMonitoring,
  reportPerformance 
} from '@/lib/performance';

interface PerformanceContextType {
  monitor: PerformanceMonitor;
  reportPerformance: () => void;
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const monitor = PerformanceMonitor.getInstance();

  useEffect(() => {
    // Initialize performance monitoring
    initializePerformanceMonitoring();

    // Report performance on page load
    const timer = setTimeout(() => {
      reportPerformance();
    }, 2000);

    return () => {
      clearTimeout(timer);
      monitor.cleanup();
    };
  }, [monitor]);

  const value = {
    monitor,
    reportPerformance,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
}
