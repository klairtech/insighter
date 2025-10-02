import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface PremiumMembership {
  id: string;
  plan_type: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  monthly_credits: number;
  price_inr: number;
  is_annual: boolean;
}

interface UsePremiumMembershipReturn {
  membership: PremiumMembership | null;
  isLoading: boolean;
  error: string | null;
  isPremium: boolean;
  membershipExpiry: Date | null;
  daysUntilExpiry: number | null;
}

export function usePremiumMembership(): UsePremiumMembershipReturn {
  const authContext = useSupabaseAuth();
  const { user } = authContext || { user: null };
  const [membership, setMembership] = useState<PremiumMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembership = async () => {
      // Only fetch membership if user is authenticated
      if (!user) {
        setMembership(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/billing/subscription');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch subscription: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.subscription && data.subscription.plan_type !== 'free') {
          setMembership(data.subscription);
        } else {
          setMembership(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setMembership(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembership();
  }, [user]);

  const isPremium = membership !== null && membership.plan_type === 'premium';
  const membershipExpiry = membership ? new Date(membership.current_period_end) : null;
  
  const daysUntilExpiry = membershipExpiry 
    ? Math.ceil((membershipExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    membership,
    isLoading,
    error,
    isPremium,
    membershipExpiry,
    daysUntilExpiry,
  };
}
