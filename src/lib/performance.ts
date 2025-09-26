// Performance monitoring utilities for client-side optimization
import React from 'react'

// Type definitions for performance entries
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number
}

interface LayoutShift extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, number> = new Map()
  private observers: PerformanceObserver[] = []

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // Measure component render time
  measureRender(componentName: string, startTime: number): void {
    const endTime = performance.now()
    const renderTime = endTime - startTime
    this.metrics.set(`${componentName}_render`, renderTime)
    
    // Log slow renders
    if (renderTime > 100) {
      console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`)
    }
  }

  // Measure API call performance
  measureApiCall(endpoint: string, startTime: number): void {
    const endTime = performance.now()
    const apiTime = endTime - startTime
    this.metrics.set(`${endpoint}_api`, apiTime)
    
    // Log slow API calls
    if (apiTime > 1000) {
      console.warn(`Slow API call detected: ${endpoint} took ${apiTime.toFixed(2)}ms`)
    }
  }

  // Get performance metrics
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics)
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics.clear()
  }

  // Monitor Core Web Vitals
  startWebVitalsMonitoring(): void {
    if (typeof window === 'undefined') return

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      this.metrics.set('lcp', lastEntry.startTime)
    })
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
    this.observers.push(lcpObserver)

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        const fidEntry = entry as PerformanceEventTiming
        this.metrics.set('fid', fidEntry.processingStart - entry.startTime)
      })
    })
    fidObserver.observe({ entryTypes: ['first-input'] })
    this.observers.push(fidObserver)

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0
      const entries = list.getEntries()
      entries.forEach((entry) => {
        const clsEntry = entry as LayoutShift
        if (!clsEntry.hadRecentInput) {
          clsValue += clsEntry.value
        }
      })
      this.metrics.set('cls', clsValue)
    })
    clsObserver.observe({ entryTypes: ['layout-shift'] })
    this.observers.push(clsObserver)
  }

  // Cleanup observers
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

// React hook for measuring component performance
export function usePerformanceMonitor(componentName: string) {
  const startTime = performance.now()
  
  React.useEffect(() => {
    const monitor = PerformanceMonitor.getInstance()
    monitor.measureRender(componentName, startTime)
  })
}

// Utility for measuring async operations
export async function measureAsync<T>(
  operation: () => Promise<T>,
  name: string
): Promise<T> {
  const startTime = performance.now()
  try {
    const result = await operation()
    const monitor = PerformanceMonitor.getInstance()
    monitor.measureApiCall(name, startTime)
    return result
  } catch (error) {
    const monitor = PerformanceMonitor.getInstance()
    monitor.measureApiCall(`${name}_error`, startTime)
    throw error
  }
}

// Bundle size monitoring
export function getBundleSize(): number {
  if (typeof window === 'undefined') return 0
  
  const scripts = document.querySelectorAll('script[src]')
  let totalSize = 0
  
  scripts.forEach(script => {
    const src = script.getAttribute('src')
    if (src && src.includes('_next/static')) {
      // This is a rough estimate - in production you'd want more accurate measurement
      totalSize += 100000 // Assume ~100KB per script
    }
  })
  
  return totalSize
}

// Memory usage monitoring
export function getMemoryUsage(): {
  used: number
  total: number
  percentage: number
} {
  if (typeof window === 'undefined' || !('memory' in performance)) {
    return { used: 0, total: 0, percentage: 0 }
  }

  const memory = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
  }
}

// Network performance monitoring
export function getNetworkInfo(): {
  connection: string
  effectiveType: string
  downlink: number
  rtt: number
} {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return { connection: 'unknown', effectiveType: 'unknown', downlink: 0, rtt: 0 }
  }

  const connection = (navigator as { connection: { type?: string; effectiveType?: string; downlink?: number; rtt?: number } }).connection
  return {
    connection: connection.type || 'unknown',
    effectiveType: connection.effectiveType || 'unknown',
    downlink: connection.downlink || 0,
    rtt: connection.rtt || 0
  }
}

// Performance reporting utility
export function reportPerformance(): void {
  // const monitor = PerformanceMonitor.getInstance()
  // const metrics = monitor.getMetrics()
  // const memory = getMemoryUsage()
  // const network = getNetworkInfo()
  // const bundleSize = getBundleSize()

  // const _report = {
  //   timestamp: new Date().toISOString(),
  //   metrics,
  //   memory,
  //   network,
  //   bundleSize,
  //   userAgent: navigator.userAgent,
  //   url: window.location.href
  // }

  // In production, you'd send this to your analytics service
  // // Example: Send to analytics
  // fetch('/api/analytics/performance', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(report)
  // })
}

// Initialize performance monitoring
export function initializePerformanceMonitoring(): void {
  if (typeof window === 'undefined') return

  const monitor = PerformanceMonitor.getInstance()
  monitor.startWebVitalsMonitoring()

  // Report performance on page unload
  window.addEventListener('beforeunload', reportPerformance)

  // Report performance every 30 seconds
  setInterval(reportPerformance, 30000)
}

