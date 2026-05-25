import { create } from "zustand";
import type { ExerciseImageData } from "@/lib/exercise-media";

interface PendingSwapStore {
  result: {
    id: string;
    name: string;
    image?: ExerciseImageData;
    exerciseType?: "weight" | "time";
  } | null;
  setResult: (
    result: {
      id: string;
      name: string;
      image?: ExerciseImageData;
      exerciseType?: "weight" | "time";
    } | null
  ) => void;
}

export const usePendingSwapStore = create<PendingSwapStore>()((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
