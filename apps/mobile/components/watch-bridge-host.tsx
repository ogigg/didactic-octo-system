import { useWatchBridge } from "@/hooks/use-watch-bridge";

/** Must render under QueryClientProvider — useWatchBridge fetches localized exercise names. */
export function WatchBridgeHost() {
  useWatchBridge();
  return null;
}
