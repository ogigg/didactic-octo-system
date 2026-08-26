import { create } from "zustand";

export type PaywallSource = "generation_limit" | "subscription";

interface PaywallState {
  isOpen: boolean;
  usedCount: number;
  limitCount: number;
  source: PaywallSource;
  open: (used: number, limit: number, source?: PaywallSource) => void;
  close: () => void;
}

export const usePaywallStore = create<PaywallState>((set) => ({
  isOpen: false,
  usedCount: 5,
  limitCount: 5,
  source: "generation_limit",
  open: (used, limit, source = "generation_limit") =>
    set({ isOpen: true, usedCount: used, limitCount: limit, source }),
  close: () => set({ isOpen: false }),
}));
