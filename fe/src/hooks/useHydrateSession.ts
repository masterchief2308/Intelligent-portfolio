'use client';

import { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';

export function useHydrateSession() {
  const { personalization, setPersonalization } = usePortfolioStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cached = localStorage.getItem('user_profile_complete');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.personalization?.website_config?.featured_projects?.[0]?.id === 'rag-portfolio') {
          localStorage.removeItem('user_profile_complete');
          setPersonalization(null);
        } else {
          setPersonalization(parsed.personalization);
        }
      } catch {
        localStorage.removeItem('user_profile_complete');
      }
    }
  }, [setPersonalization]);

  return { mounted, personalization, setPersonalization };
}
