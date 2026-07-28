import { create } from "zustand";

interface ToastMessage {
  id: number;
  message: string;
  tone: "success";
}

interface ToastState {
  toast: ToastMessage | null;
  showSuccess: (message: string) => void;
  dismiss: () => void;
}

let nextToastId = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>()((set) => ({
  toast: null,
  showSuccess: (message) => {
    if (dismissTimer) clearTimeout(dismissTimer);

    nextToastId += 1;
    set({
      toast: {
        id: nextToastId,
        message,
        tone: "success",
      },
    });

    dismissTimer = setTimeout(() => {
      dismissTimer = null;
      set({ toast: null });
    }, 2500);
  },
  dismiss: () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = null;
    set({ toast: null });
  },
}));
