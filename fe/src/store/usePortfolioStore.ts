import { create } from 'zustand';
import type { PersonalizationData, PortfolioData } from '@/types';

interface PortfolioState {
  portfolioData: PortfolioData | null;
  setPortfolioData: (data: PortfolioData | null) => void;
  personalization: PersonalizationData | null;
  setPersonalization: (data: PersonalizationData | null) => void;
  adminToken: string | null;
  setAdminToken: (token: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isStreamingLLM: boolean;
  setIsStreamingLLM: (streaming: boolean) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  portfolioData: null,
  setPortfolioData: (data) => set({ portfolioData: data }),
  personalization: null,
  setPersonalization: (data) => set({ personalization: data }),
  adminToken: null,
  setAdminToken: (token) => set({ adminToken: token }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  isStreamingLLM: false,
  setIsStreamingLLM: (streaming) => set({ isStreamingLLM: streaming }),
}));
