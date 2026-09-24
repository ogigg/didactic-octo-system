import NetInfo from "@react-native-community/netinfo";

import { syncQueue, type SyncQueue } from "@/lib/sync-queue";

interface NetworkState {
  isConnected: boolean | null;
}

interface SyncQueueBootstrapOptions {
  queue?: Pick<SyncQueue, "hydrate" | "setOnline" | "processQueue">;
  fetchNetworkState?: () => Promise<NetworkState>;
}

export async function bootstrapSyncQueue({
  queue = syncQueue,
  fetchNetworkState = () => NetInfo.fetch(),
}: SyncQueueBootstrapOptions = {}): Promise<void> {
  const [networkState] = await Promise.all([
    fetchNetworkState(),
    queue.hydrate(),
  ]);
  const isOnline = networkState.isConnected === true;

  queue.setOnline(isOnline);
  if (isOnline) {
    await queue.processQueue();
  }
}
