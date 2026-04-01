import { create } from "zustand";

interface PendingSwapStore {
  result: { id: string; name: string } | null;
  setResult: (result: { id: string; name: string } | null) => void;
}

export const usePendingSwapStore = create<PendingSwapStore>()((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
