"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface CurrencySelectorProps {
  onCurrencyChange?: (currency: string) => void;
  className?: string;
  initialCurrency?: string;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  onCurrencyChange,
  className = "",
  initialCurrency,
}) => {
  const { user, session } = useSupabaseAuth();
  const [selectedCurrency, setSelectedCurrency] = useState(
    initialCurrency || "INR"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [availableCurrencies] = useState([
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
  ]);

  const fetchUserCurrency = useCallback(async () => {
    try {
      if (!session?.access_token) {
        return;
      }

      const response = await fetch("/api/user/currency", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCurrency(data.preferred_currency || "INR");
      }
    } catch (_error) {}
  }, [session]);

  useEffect(() => {
    if (user) {
      fetchUserCurrency();
    }
  }, [user, fetchUserCurrency]);

  const handleCurrencyChange = async (currency: string) => {
    if (currency === selectedCurrency) return;

    if (!session?.access_token) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/user/currency", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ preferred_currency: currency }),
      });

      if (response.ok) {
        setSelectedCurrency(currency);
        onCurrencyChange?.(currency);
      } else {
      }
    } catch (_error) {
    } finally {
      setIsLoading(false);
    }
  };

  const _getCurrencySymbol = (code: string) => {
    return availableCurrencies.find((c) => c.code === code)?.symbol || code;
  };

  if (!user) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm text-gray-400">Currency:</span>
      <select
        value={selectedCurrency}
        onChange={(e) => handleCurrencyChange(e.target.value)}
        disabled={isLoading}
        className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        {availableCurrencies.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.symbol} {currency.code} - {currency.name}
          </option>
        ))}
      </select>
      {isLoading && (
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      )}
    </div>
  );
};

export default CurrencySelector;
