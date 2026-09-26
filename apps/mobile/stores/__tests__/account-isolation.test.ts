import AsyncStorage from "@react-native-async-storage/async-storage";
import { act } from "@testing-library/react-native";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock("@/lib/api/profiles", () => ({
  fetchProfile: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("@/lib/api/delete-account", () => ({
  cancelAccountDeletion: jest.fn(() => Promise.resolve(false)),
}));

jest.mock("@/lib/posthog", () => ({
  flushPostHog: jest.fn(),
}));

jest.mock("@/lib/track-event", () => ({
  identifyUser: jest.fn(),
  resetUser: jest.fn(),
  setUserProperties: jest.fn(),
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/watch-workout-publisher", () => ({
  publishCancelledWorkoutToWatch: jest.fn(() => Promise.resolve(true)),
}));

import { supabase } from "@/lib/supabase";
import { syncQueue } from "@/lib/sync-queue";
import { eraseLocalAccountData } from "@/stores/account-data";
import { useAuthStore } from "@/stores/auth-store";
import { usePendingWorkoutStore } from "@/stores/pending-workout-store";
import {
  LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY,
  useWorkoutTemplatesStore,
  waitForWorkoutTemplatesPersistence,
  workoutTemplatesStorageKey,
} from "@/stores/workout-templates-store";
import { useWorkoutStore, type WorkoutExercise } from "@/stores/workout-store";

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;

type AuthCallback = (event: string, session: unknown) => void;

const exercises = [{ id: "bench-press", name: "Bench Press" }];

const workoutExercise: WorkoutExercise = {
  id: "squat",
  name: "Squat",
  exerciseType: "weight",
  restDurationSeconds: 120,
  notes: "",
  difficultyFeedback: null,
  sets: [],
};

function sessionFor(userId: string, lastSignInAt?: string) {
  return { user: { id: userId, last_sign_in_at: lastSignInAt } };
}

function templateNames(): string[] {
  return useWorkoutTemplatesStore.getState().templates.map((t) => t.name);
}

function saveTemplate(name: string) {
  useWorkoutTemplatesStore.getState().addTemplate({ name, exercises });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await waitForWorkoutTemplatesPersistence();
  });
}

describe("account isolation of local data", () => {
  let callback: AuthCallback;
  let stop: () => void;
  let replayed: { owner: string | null; id: string }[];

  function start(restored: unknown = null) {
    mockAuth.getSession.mockResolvedValue({
      data: { session: restored },
    } as never);
    stop = useAuthStore.getState().initialize();
  }

  beforeAll(() => {
    syncQueue.registerHandler("test_write", async (_payload, item) => {
      replayed.push({ owner: item.ownerId, id: item.id });
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    replayed = [];
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      callback = cb as AuthCallback;
      return { data: { subscription: { unsubscribe: jest.fn() } } } as never;
    });
    mockAuth.signOut.mockImplementation(async () => {
      callback("SIGNED_OUT", null);
      return { error: null };
    });
    useAuthStore.setState({ session: null, profileStatus: "loading" });
    useWorkoutTemplatesStore.getState().setOwner(null);
    usePendingWorkoutStore.getState().prepareForUser(null);
    useWorkoutStore.getState().clearWorkout({ suppressAbandonment: true });
    useWorkoutStore.setState({ ownerUserId: null });
    syncQueue.setActiveUser(null);
    await syncQueue.flush();
    await waitForWorkoutTemplatesPersistence();
    await AsyncStorage.clear();
  });

  afterEach(() => stop?.());

  it("shows B none of A's templates after A signs out", async () => {
    start(sessionFor("user-a"));
    await settle();
    saveTemplate("A push day");
    await settle();

    await act(async () => {
      await useAuthStore.getState().signOut();
    });
    expect(templateNames()).toEqual([]);

    callback("SIGNED_IN", sessionFor("user-b"));
    await settle();

    expect(useWorkoutTemplatesStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      templates: [],
      hasHydrated: true,
    });
  });

  it("switches templates synchronously when B replaces A without a sign-out", async () => {
    start(sessionFor("user-a"));
    await settle();
    saveTemplate("A push day");
    usePendingWorkoutStore
      .getState()
      .markQueueGenerationStarted("onboarding", "request-a");

    callback("SIGNED_IN", sessionFor("user-b"));

    expect(templateNames()).toEqual([]);
    expect(usePendingWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      queueGenerationRequestId: null,
    });
    await settle();
    expect(templateNames()).toEqual([]);
  });

  it("does not let A's slow template load reach B", async () => {
    await AsyncStorage.setItem(
      workoutTemplatesStorageKey("user-a"),
      JSON.stringify({
        ownerUserId: "user-a",
        templates: [{ id: "a", name: "A push day", exercises, createdAt: 1 }],
      })
    );
    const getItem = AsyncStorage.getItem as jest.Mock;
    const realGetItem = getItem.getMockImplementation()!;
    let releaseA!: () => void;
    const aReleased = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    getItem.mockImplementation(async (key: string) => {
      if (key === workoutTemplatesStorageKey("user-a")) await aReleased;
      return realGetItem(key);
    });

    start(sessionFor("user-a"));
    await settle();
    callback("SIGNED_IN", sessionFor("user-b"));
    await settle();
    releaseA();
    await settle();

    expect(useWorkoutTemplatesStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      templates: [],
    });
    getItem.mockImplementation(realGetItem);
  });

  it("brings A's templates back when A signs in again after a restart", async () => {
    start(sessionFor("user-a"));
    await settle();
    saveTemplate("A push day");
    await settle();
    stop();
    // The in-memory store is gone after a restart; only storage remains.
    useWorkoutTemplatesStore.setState({
      ownerUserId: null,
      templates: [],
      hasHydrated: false,
    });

    start(sessionFor("user-a"));
    await settle();

    expect(templateNames()).toEqual(["A push day"]);
  });

  it("never gives A ownerless data B left behind, even with a future timestamp", async () => {
    const future = Date.now() + 24 * 60 * 60 * 1000;
    const legacy = JSON.stringify({
      state: {
        templates: [
          { id: "b", name: "B legacy", exercises, createdAt: future },
        ],
      },
      version: 0,
    });
    await AsyncStorage.setItem(LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY, legacy);
    useWorkoutStore.getState().startWorkout("B legs", [workoutExercise]);
    useWorkoutStore.setState({ ownerUserId: null, startedAtMs: future });

    start(sessionFor("user-a", new Date(Date.now() - 1000).toISOString()));
    await settle();

    expect(templateNames()).toEqual([]);
    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-a",
      isActive: false,
      workoutName: "",
    });
    // Quarantined, not claimed and not deleted.
    expect(
      await AsyncStorage.getItem(LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY)
    ).toBe(legacy);
  });

  it("keeps A's offline write for A and never replays it for B", async () => {
    start(sessionFor("user-a"));
    await settle();
    syncQueue.setOnline(false);
    await syncQueue.enqueue("test_write", "workout-a", {});

    await act(async () => {
      await useAuthStore.getState().signOut();
    });
    syncQueue.setOnline(true);
    callback("SIGNED_IN", sessionFor("user-b"));
    await settle();

    expect(replayed).toEqual([]);
    expect(syncQueue.getHealthSnapshot().pendingCount).toBe(0);

    await act(async () => {
      await useAuthStore.getState().signOut();
    });
    callback("SIGNED_IN", sessionFor("user-a"));
    await settle();

    expect(replayed).toEqual([{ owner: "user-a", id: "workout-a" }]);
  });

  it("erases only the erased account's local data", async () => {
    start(sessionFor("user-b"));
    await settle();
    saveTemplate("B leg day");
    await settle();
    await act(async () => {
      await useAuthStore.getState().signOut();
    });

    callback("SIGNED_IN", sessionFor("user-a"));
    await settle();
    saveTemplate("A push day");
    syncQueue.setOnline(false);
    await syncQueue.enqueue("test_write", "workout-a", {});
    await syncQueue.enqueue("test_write", "workout-b", {}, "user-b");
    useWorkoutStore.getState().startWorkout("A legs", [workoutExercise]);
    await settle();
    await act(async () => {
      await useAuthStore.getState().signOut();
    });

    await eraseLocalAccountData("user-a");

    expect(
      await AsyncStorage.getItem(workoutTemplatesStorageKey("user-a"))
    ).toBeNull();
    expect(
      await AsyncStorage.getItem(workoutTemplatesStorageKey("user-b"))
    ).toContain("B leg day");
    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: null,
      isActive: false,
    });

    syncQueue.setOnline(true);
    callback("SIGNED_IN", sessionFor("user-a"));
    await settle();
    expect(templateNames()).toEqual([]);
    expect(replayed).toEqual([]);

    await act(async () => {
      await useAuthStore.getState().signOut();
    });
    callback("SIGNED_IN", sessionFor("user-b"));
    await settle();
    expect(templateNames()).toEqual(["B leg day"]);
    expect(replayed).toEqual([{ owner: "user-b", id: "workout-b" }]);
  });
});
