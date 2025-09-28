import { NextRequest, NextResponse } from "next/server";
import { calculateCreditPricing, formatCurrency, type SupportedCurrency } from "@/lib/pricing-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credits = parseInt(searchParams.get('credits') || '100');
    const currency = (searchParams.get('currency') || 'INR') as SupportedCurrency;

    // Validate inputs
    if (credits % 100 !== 0 || credits < 100) {
      return NextResponse.json(
        { error: "Credits must be a multiple of 100 and at least 100" },
        { status: 400 }
      );
    }

    if (!['INR', 'USD', 'EUR', 'GBP'].includes(currency)) {
      return NextResponse.json(
        { error: "Unsupported currency. Must be one of: INR, USD, EUR, GBP" },
        { status: 400 }
      );
    }

    // Calculate pricing
    const pricing = calculateCreditPricing(credits, currency);

    return NextResponse.json({
      success: true,
      input: {
        credits,
        currency
      },
      pricing: {
        base_credits: pricing.baseCredits,
        bonus_credits: pricing.bonusCredits,
        total_credits: pricing.totalCredits,
        base_price_inr: pricing.basePriceInr,
        original_price_rupees: pricing.originalPrice,
        final_amount: pricing.finalAmount,
        final_currency: pricing.finalCurrency,
        formatted_price: formatCurrency(pricing.finalAmount, pricing.finalCurrency),
        markup: pricing.markup,
        markup_percentage: 30
      },
      explanation: {
        base_pricing: "₹99 per 100 credits in INR",
        markup: "30% markup applied to all non-INR currencies",
        rounding: "Rounded to nearest .99 value",
        example: `₹99 → ${formatCurrency(pricing.finalAmount, pricing.finalCurrency)} (with 30% markup + .99 rounding)`
      }
    });

  } catch (error) {
    console.error("Pricing test error:", error);
    return NextResponse.json(
      { error: "Failed to calculate pricing" },
      { status: 500 }
    );
  }
}
