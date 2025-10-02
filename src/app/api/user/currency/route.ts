import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/server-utils";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's current currency preference
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('preferred_currency, country')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error("Error fetching user currency:", userError);
      return NextResponse.json(
        { error: "Failed to fetch currency preference" },
        { status: 500 }
      );
    }

    // Get available currencies and exchange rates
    const { data: exchangeRates, error: ratesError } = await supabase
      .from('exchange_rates')
      .select('base_currency, target_currency, rate, last_updated')
      .eq('is_active', true)
      .order('base_currency');

    if (ratesError) {
      console.error("Error fetching exchange rates:", ratesError);
    }

    return NextResponse.json({
      preferred_currency: userData.preferred_currency || 'INR',
      country: userData.country,
      available_currencies: ['USD', 'INR', 'EUR', 'GBP'],
      exchange_rates: exchangeRates || []
    });

  } catch (error) {
    console.error("Currency preference error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { preferred_currency } = body;

    // Validate currency
    const validCurrencies = ['USD', 'INR', 'EUR', 'GBP'];
    if (!validCurrencies.includes(preferred_currency)) {
      return NextResponse.json(
        { error: "Invalid currency. Must be one of: USD, INR, EUR, GBP" },
        { status: 400 }
      );
    }

    // Update user's currency preference
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        preferred_currency,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error("Error updating currency preference:", updateError);
      return NextResponse.json(
        { error: "Failed to update currency preference" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferred_currency,
      message: "Currency preference updated successfully"
    });

  } catch (error) {
    console.error("Currency update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
