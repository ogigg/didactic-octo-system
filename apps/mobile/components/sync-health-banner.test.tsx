import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import type { SyncHealthSnapshot } from "@/lib/sync-queue";

const mockPush = jest.fn();
let mockSnapshot: SyncHealthSnapshot;
const mockSyncQueue = {
  subscribe: jest.fn(() => jest.fn()),
  getHealthSnapshot: jest.fn(() => mockSnapshot),
  acknowledgeRecovery: jest.fn(),
  retryDeadItems: jest.fn(() => Promise.resolve()),
  processQueue: jest.fn(() => Promise.resolve()),
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { reference?: string }) =>
      values?.reference ? `${key}:${values.reference}` : key,
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: () => "#000000",
}));
import { SyncHealthBanner } from "./sync-health-banner";

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot = {
    state: "saved",
    pendingCount: 0,
    failedCount: 0,
    canContactSupport: false,
  };
});

describe("SyncHealthBanner", () => {
  it("does not add noise for normal saved state", () => {
    render(<SyncHealthBanner queue={mockSyncQueue} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("truthfully identifies device-only preservation while offline", () => {
    mockSnapshot = {
      state: "offline",
      pendingCount: 1,
      failedCount: 0,
      canContactSupport: false,
    };

    render(<SyncHealthBanner queue={mockSyncQueue} />);
    expect(screen.getByText("sync.offline")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("retries dead items once and starts processing", async () => {
    mockSnapshot = {
      state: "failed",
      pendingCount: 0,
      failedCount: 1,
      diagnosticReference: "SYNC-TEST0001",
      canContactSupport: false,
    };

    render(<SyncHealthBanner queue={mockSyncQueue} />);
    fireEvent.press(screen.getByRole("button", { name: "sync.retry" }));

    await waitFor(() => {
      expect(mockSyncQueue.retryDeadItems).toHaveBeenCalledTimes(1);
      expect(mockSyncQueue.processQueue).toHaveBeenCalledTimes(1);
    });
  });

  it("offers support with the anonymous reference after repeated failure", () => {
    mockSnapshot = {
      state: "failed",
      pendingCount: 0,
      failedCount: 1,
      diagnosticReference: "SYNC-TEST0002",
      canContactSupport: true,
    };

    render(<SyncHealthBanner queue={mockSyncQueue} />);
    expect(screen.getByText("sync.reference:SYNC-TEST0002")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "sync.support" }));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/feedback",
      params: { diagnosticReference: "SYNC-TEST0002" },
    });
  });
});
