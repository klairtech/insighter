"use client";

import React, { useState, useEffect } from "react";
import { Coins } from "lucide-react";

interface CreditBalanceProps {
  className?: string;
}

const CreditBalance: React.FC<CreditBalanceProps> = ({ className = "" }) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCreditBalance();
  }, []);

  const fetchCreditBalance = async () => {
    try {
      const response = await fetch("/api/credits/balance");
      const data = await response.json();

      if (response.ok) {
        setBalance(data.balance);
      } else {
        console.error("Failed to fetch credit balance:", data.error);
      }
    } catch (error) {
      console.error("Error fetching credit balance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 text-gray-400 ${className}`}>
        <Coins size={16} />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Coins size={16} className="text-yellow-400" />
      <span className="text-sm text-gray-300">
        {balance !== null ? `${balance} credits` : "No credits"}
      </span>
    </div>
  );
};

export default CreditBalance;
