import { create } from "zustand";

interface PaywallState {
  isOpen: boolean;
  usedCount: number;
  limitCount: number;
  open: (used: number, limit: number) => void;
  close: () => void;
}

export const usePaywallStore = create<PaywallState>((set) => ({
  isOpen: false,
  usedCount: 5,
  limitCount: 5,
  open: (used, limit) =>
    set({ isOpen: true, usedCount: used, limitCount: limit }),
  close: () => set({ isOpen: false }),
}));
