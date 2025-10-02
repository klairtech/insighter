"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Coins } from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface CreditBalanceProps {
  className?: string;
}

const CreditBalance: React.FC<CreditBalanceProps> = ({ className = "" }) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authContext = useSupabaseAuth();
  const { user, session } = authContext || { user: null, session: null };

  const fetchCreditBalance = useCallback(async () => {
    try {
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/credits/balance", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await response.json();

      if (response.ok) {
        setBalance(data.balance);
      } else {
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (user && session) {
      fetchCreditBalance();
    } else {
      setIsLoading(false);
    }
  }, [user, session, fetchCreditBalance]);

  // Don't render if user is not authenticated
  if (!user) {
    return null;
  }

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
