/**
 * Payment Error Handler for Razorpay Transactions
 * Handles failed, timeout, cancelled, and other transaction states
 */

export interface PaymentError {
  code: string;
  message: string;
  type: 'failed' | 'timeout' | 'cancelled' | 'network' | 'validation' | 'unknown';
  details?: Record<string, unknown>;
  retryable: boolean;
}

export interface PaymentResult {
  success: boolean;
  error?: PaymentError;
  data?: Record<string, unknown>;
}

/**
 * Parse Razorpay error codes and return structured error information
 */
export function parseRazorpayError(error: unknown): PaymentError {
  // Handle empty or null error objects
  if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred. Please try again or contact support.',
      type: 'unknown',
      retryable: true,
      details: { originalError: error }
    };
  }

  // Type guard for error object
  const errorObj = error as Record<string, unknown>;
  const errorCode = errorObj.code as string;
  const errorMessage = errorObj.message as string;

  // Handle timeout errors first (before network check)
  if (errorCode === 'TIMEOUT' || errorMessage?.toLowerCase().includes('timeout')) {
    return {
      code: 'PAYMENT_TIMEOUT',
      message: 'Payment timed out. Your payment may still be processing. Please check your account or try again.',
      type: 'timeout',
      retryable: true
    };
  }

  // Handle network errors (only if explicitly network-related)
  if (errorCode === 'NETWORK_ERROR' || errorMessage?.toLowerCase().includes('network')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network connection failed. Please check your internet connection and try again.',
      type: 'network',
      retryable: true
    };
  }

  // Handle user cancellation
  if (errorCode === 'USER_CANCELLED' || errorMessage?.includes('cancelled')) {
    return {
      code: 'USER_CANCELLED',
      message: 'Payment was cancelled. No charges have been made.',
      type: 'cancelled',
      retryable: true
    };
  }

  // Handle validation errors
  if (errorCode === 'BAD_REQUEST_ERROR' || errorMessage?.includes('validation')) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Invalid payment details. Please check your information and try again.',
      type: 'validation',
      retryable: true
    };
  }

  // Handle payment failures
  if (errorCode === 'PAYMENT_FAILED' || errorMessage?.includes('failed')) {
    return {
      code: 'PAYMENT_FAILED',
      message: 'Payment failed. Please try again or use a different payment method.',
      type: 'failed',
      retryable: true
    };
  }

  // Handle insufficient funds
  if (errorCode === 'INSUFFICIENT_FUNDS') {
    return {
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient funds. Please check your account balance or use a different payment method.',
      type: 'failed',
      retryable: true
    };
  }

  // Handle card declined
  if (errorCode === 'CARD_DECLINED') {
    return {
      code: 'CARD_DECLINED',
      message: 'Your card was declined. Please try a different card or contact your bank.',
      type: 'failed',
      retryable: true
    };
  }

  // Handle server errors
  if (errorCode === 'INTERNAL_SERVER_ERROR' || (errorObj.status as number) >= 500) {
    return {
      code: 'SERVER_ERROR',
      message: 'Server error occurred. Please try again in a few minutes.',
      type: 'failed',
      retryable: true
    };
  }

  // Default unknown error
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred. Please try again or contact support.',
    type: 'unknown',
    retryable: true,
    details: { originalError: error }
  };
}

/**
 * Handle payment verification errors
 */
export function parsePaymentVerificationError(error: unknown): PaymentError {
  // Handle empty or null error objects
  if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred during payment verification. Please try again or contact support.',
      type: 'unknown',
      retryable: true,
      details: { originalError: error }
    };
  }

  // Type guard for error object
  const errorObj = error as Record<string, unknown>;
  const errorMessage = errorObj.message as string;

  if (errorMessage?.includes('signature')) {
    return {
      code: 'SIGNATURE_VERIFICATION_FAILED',
      message: 'Payment verification failed. Please contact support with your payment ID.',
      type: 'failed',
      retryable: false
    };
  }

  if (errorMessage?.includes('Unauthorized')) {
    return {
      code: 'AUTHENTICATION_FAILED',
      message: 'Authentication failed. Please log in again and try the payment.',
      type: 'failed',
      retryable: true
    };
  }

  return parseRazorpayError(error);
}

/**
 * Get user-friendly error message with action suggestions
 */
export function getErrorMessage(error: PaymentError): string {
  const baseMessage = error.message;
  
  if (error.retryable) {
    return `${baseMessage} You can try again or contact support if the issue persists.`;
  }
  
  return `${baseMessage} Please contact support for assistance.`;
}

/**
 * Get retry delay based on error type
 */
export function getRetryDelay(error: PaymentError): number {
  switch (error.type) {
    case 'network':
      return 2000; // 2 seconds for network issues
    case 'timeout':
      return 5000; // 5 seconds for timeouts
    case 'cancelled':
      return 0; // No delay for user cancellation
    case 'failed':
      return 3000; // 3 seconds for payment failures
    default:
      return 2000; // 2 seconds default
  }
}

/**
 * Check if error should trigger a retry
 */
export function shouldRetry(error: PaymentError, attemptCount: number): boolean {
  if (!error.retryable) return false;
  if (attemptCount >= 3) return false; // Max 3 attempts
  
  // Don't retry user cancellations
  if (error.type === 'cancelled') return false;
  
  return true;
}

/**
 * Log payment error for debugging
 */
export function logPaymentError(error: PaymentError, context: string, details?: Record<string, unknown>) {
  console.error(`[Payment Error - ${context}]`, {
    code: error.code,
    type: error.type,
    message: error.message,
    retryable: error.retryable,
    context,
    details,
    timestamp: new Date().toISOString()
  });
}
