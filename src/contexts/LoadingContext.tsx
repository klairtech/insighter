"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

interface LoadingState {
  [key: string]: boolean;
}

interface LoadingContextType {
  isLoading: (key: string) => boolean;
  setLoading: (key: string, loading: boolean) => void;
  startLoading: (key: string) => void;
  stopLoading: (key: string) => void;
  clearAllLoading: () => void;
  withLoading: <T extends unknown[], R>(
    key: string,
    fn: (...args: T) => Promise<R>
  ) => (...args: T) => Promise<R>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  // Clear all loading states when the component mounts (page load)
  useEffect(() => {
    // Clear any stuck loading states from previous page
    setLoadingStates({});
  }, []);

  const isLoading = useCallback(
    (key: string) => {
      return loadingStates[key] || false;
    },
    [loadingStates]
  );

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates((prev) => ({
      ...prev,
      [key]: loading,
    }));
  }, []);

  const startLoading = useCallback(
    (key: string) => {
      setLoading(key, true);
    },
    [setLoading]
  );

  const stopLoading = useCallback(
    (key: string) => {
      setLoading(key, false);
    },
    [setLoading]
  );

  const clearAllLoading = useCallback(() => {
    setLoadingStates({});
  }, []);

  const withLoading = useCallback(
    <T extends unknown[], R>(key: string, fn: (...args: T) => Promise<R>) => {
      return async (...args: T): Promise<R> => {
        startLoading(key);
        try {
          const result = await fn(...args);
          return result;
        } finally {
          stopLoading(key);
        }
      };
    },
    [startLoading, stopLoading]
  );

  const value: LoadingContextType = {
    isLoading,
    setLoading,
    startLoading,
    stopLoading,
    clearAllLoading,
    withLoading,
  };

  return (
    <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}

// Hook for navigation loading
export function useNavigationLoading() {
  const { isLoading, startLoading, stopLoading } = useLoading();

  const navigateWithLoading = useCallback(
    (
      href: string,
      router: {
        push: (href: string) => void;
      }
    ) => {
      const loadingKey = `navigation-${href}`;
      startLoading(loadingKey);

      // For App Router, we'll stop loading after a short delay
      // The useEffect cleanup in LoadingLink will handle the actual cleanup
      setTimeout(() => {
        stopLoading(loadingKey);
      }, 1000);

      router.push(href);
    },
    [startLoading, stopLoading]
  );

  return {
    isNavigating: (href: string) => isLoading(`navigation-${href}`),
    navigateWithLoading,
  };
}
