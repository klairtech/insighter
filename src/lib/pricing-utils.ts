/**
 * Pricing utilities for Insighter
 * All pricing is based on INR with 30% markup and .99 rounding
 */

// Base pricing in INR (in paise for precision)
export const BASE_PRICING = {
  // ₹99 per 100 credits (in paise)
  CREDITS_PER_100: 9900,
  // ₹99 per 100 credits (in rupees)
  CREDITS_PER_100_RUPEES: 99,
} as const;

// Exchange rates (approximate, should be updated regularly)
export const EXCHANGE_RATES = {
  'INR': 1.0,
  'USD': 0.012, // 1 INR = 0.012 USD
  'EUR': 0.011, // 1 INR = 0.011 EUR
  'GBP': 0.0095, // 1 INR = 0.0095 GBP
} as const;

export type SupportedCurrency = keyof typeof EXCHANGE_RATES;

/**
 * Calculate price with 30% markup and round to .99
 * @param baseAmount - Base amount in the target currency
 * @returns Final price with markup and .99 rounding
 */
export function applyMarkupAndRounding(baseAmount: number): number {
  // Add 30% markup
  const withMarkup = baseAmount * 1.30;
  
  // Round to nearest .99 value
  // For example: 1.50 -> 1.99, 2.30 -> 2.99, 3.80 -> 3.99
  const rounded = Math.floor(withMarkup) + 0.99;
  
  return Math.round(rounded * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert INR amount to target currency with markup and .99 rounding
 * @param inrAmount - Amount in INR (in paise)
 * @param targetCurrency - Target currency code
 * @returns Converted amount in target currency (in smallest unit)
 */
export function convertInrToCurrency(
  inrAmount: number, 
  targetCurrency: SupportedCurrency
): { amount: number; currency: string } {
  // If target is INR, return as is
  if (targetCurrency === 'INR') {
    return { amount: inrAmount, currency: 'INR' };
  }

  // Convert from paise to rupees
  const inrRupees = inrAmount / 100;
  
  // Get exchange rate
  const rate = EXCHANGE_RATES[targetCurrency];
  if (!rate) {
    throw new Error(`Unsupported currency: ${targetCurrency}`);
  }

  // Convert to target currency
  const convertedAmount = inrRupees * rate;
  
  // Apply markup and rounding
  const finalAmount = applyMarkupAndRounding(convertedAmount);
  
  // Convert back to smallest unit (cents for USD, EUR, GBP)
  const amountInSmallestUnit = Math.round(finalAmount * 100);
  
  return { amount: amountInSmallestUnit, currency: targetCurrency };
}

/**
 * Calculate pricing for credit purchase
 * @param credits - Number of credits to purchase
 * @param targetCurrency - Target currency
 * @returns Pricing information
 */
export function calculateCreditPricing(
  credits: number, 
  targetCurrency: SupportedCurrency
): {
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
  basePriceInr: number;
  finalAmount: number;
  finalCurrency: string;
  markup: number;
  originalPrice: number;
} {
  // Validate credits (must be multiple of 100)
  if (credits % 100 !== 0 || credits < 100) {
    throw new Error('Credits must be a multiple of 100 and at least 100');
  }

  // Calculate bonus credits (5% bonus)
  const bonusCredits = Math.round((credits * 5) / 100);
  const totalCredits = credits + bonusCredits;

  // Calculate base price in INR (in paise)
  const hundredsCount = credits / 100;
  const basePriceInr = hundredsCount * BASE_PRICING.CREDITS_PER_100;

  // Convert to target currency
  const { amount: finalAmount, currency: finalCurrency } = convertInrToCurrency(
    basePriceInr, 
    targetCurrency
  );

  // Calculate markup amount
  const originalPrice = basePriceInr / 100; // Convert to rupees for display
  const finalPriceInRupees = finalAmount / 100; // Convert to display format
  const markup = finalPriceInRupees - (originalPrice * EXCHANGE_RATES[targetCurrency as SupportedCurrency]);

  return {
    baseCredits: credits,
    bonusCredits,
    totalCredits,
    basePriceInr,
    finalAmount,
    finalCurrency,
    markup,
    originalPrice,
  };
}

/**
 * Format currency amount for display
 * @param amount - Amount in smallest unit (paise, cents, etc.)
 * @param currency - Currency code
 * @returns Formatted string
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbols = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
  };

  const symbol = symbols[currency as keyof typeof symbols] || currency;
  const displayAmount = amount / 100; // Convert to display format
  
  return `${symbol}${displayAmount.toFixed(2)}`;
}

/**
 * Get currency symbol
 * @param currency - Currency code
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
  };

  return symbols[currency as keyof typeof symbols] || currency;
}
