import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  eraseWorkoutTemplatesForUser,
  LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY,
  useWorkoutTemplatesStore,
  waitForWorkoutTemplatesPersistence,
  workoutTemplatesStorageKey,
  type WorkoutTemplate,
} from "../workout-templates-store";

type MockAsyncStorage = typeof AsyncStorage & {
  __INTERNAL_MOCK_STORAGE__: Record<string, string>;
};

const mockStorage = AsyncStorage as MockAsyncStorage;

const exercises = [{ id: "bench-press", name: "Bench Press" }];

function template(id: string, createdAt = 1): WorkoutTemplate {
  return { id, name: `Template ${id}`, exercises, createdAt };
}

function templateNames(): string[] {
  return useWorkoutTemplatesStore.getState().templates.map((t) => t.name);
}

function storedTemplates(userId: string): unknown {
  const raw =
    mockStorage.__INTERNAL_MOCK_STORAGE__[workoutTemplatesStorageKey(userId)];
  return raw ? JSON.parse(raw) : null;
}

async function settle(): Promise<void> {
  await waitForWorkoutTemplatesPersistence();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await waitForWorkoutTemplatesPersistence();
}

async function signIn(userId: string | null) {
  useWorkoutTemplatesStore.getState().setOwner(userId);
  await settle();
}

describe("useWorkoutTemplatesStore", () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    useWorkoutTemplatesStore.getState().setOwner(null);
    await settle();
    await AsyncStorage.clear();
  });

  it("saves templates under the signed-in account only", async () => {
    await signIn("user-a");

    useWorkoutTemplatesStore
      .getState()
      .addTemplate({ name: "Push day", exercises });
    await settle();

    expect(storedTemplates("user-a")).toEqual({
      ownerUserId: "user-a",
      templates: [expect.objectContaining({ name: "Push day" })],
    });
    expect(
      mockStorage.__INTERNAL_MOCK_STORAGE__[
        LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY
      ]
    ).toBeUndefined();
  });

  it("clears the previous account's templates from memory at once", async () => {
    await signIn("user-a");
    useWorkoutTemplatesStore
      .getState()
      .addTemplate({ name: "Push day", exercises });

    useWorkoutTemplatesStore.getState().setOwner("user-b");

    // Synchronously, before the new account's templates load.
    expect(useWorkoutTemplatesStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      templates: [],
      hasHydrated: false,
    });
    await settle();
    expect(templateNames()).toEqual([]);
    expect(useWorkoutTemplatesStore.getState().hasHydrated).toBe(true);
  });

  it("keeps each account's templates for its next sign-in", async () => {
    await signIn("user-a");
    useWorkoutTemplatesStore
      .getState()
      .addTemplate({ name: "Push day", exercises });
    await signIn(null);
    await signIn("user-b");
    useWorkoutTemplatesStore
      .getState()
      .addTemplate({ name: "Leg day", exercises });
    await settle();

    await signIn("user-a");

    expect(templateNames()).toEqual(["Push day"]);
  });

  it("does not let a slow load restore the previous account's templates", async () => {
    await AsyncStorage.setItem(
      workoutTemplatesStorageKey("user-a"),
      JSON.stringify({ ownerUserId: "user-a", templates: [template("a")] })
    );
    const getItem = AsyncStorage.getItem as jest.Mock;
    const realGetItem = getItem.getMockImplementation()!;
    let releaseUserA!: () => void;
    const userAReleased = new Promise<void>((resolve) => {
      releaseUserA = resolve;
    });
    getItem.mockImplementation(async (key: string) => {
      if (key === workoutTemplatesStorageKey("user-a")) await userAReleased;
      return realGetItem(key);
    });

    useWorkoutTemplatesStore.getState().setOwner("user-a");
    useWorkoutTemplatesStore.getState().setOwner("user-b");
    await settle();
    releaseUserA();
    await settle();

    expect(useWorkoutTemplatesStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      templates: [],
      hasHydrated: true,
    });
    getItem.mockImplementation(realGetItem);
  });

  it("merges templates saved while the account was still loading", async () => {
    await AsyncStorage.setItem(
      workoutTemplatesStorageKey("user-a"),
      JSON.stringify({ ownerUserId: "user-a", templates: [template("old")] })
    );

    useWorkoutTemplatesStore.getState().setOwner("user-a");
    useWorkoutTemplatesStore.getState().addTemplate({ name: "New", exercises });
    await settle();

    expect(templateNames()).toEqual(["New", "Template old"]);
    expect(storedTemplates("user-a")).toMatchObject({
      templates: [{ name: "New" }, { name: "Template old" }],
    });
  });

  it("ignores a record that names another account", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await AsyncStorage.setItem(
      workoutTemplatesStorageKey("user-b"),
      JSON.stringify({ ownerUserId: "user-a", templates: [template("a")] })
    );

    await signIn("user-b");

    expect(templateNames()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("drops malformed templates and keeps valid siblings", async () => {
    await AsyncStorage.setItem(
      workoutTemplatesStorageKey("user-a"),
      JSON.stringify({
        ownerUserId: "user-a",
        templates: [template("ok"), { id: 3, name: null }],
      })
    );

    await signIn("user-a");

    expect(templateNames()).toEqual(["Template ok"]);
  });

  it("ignores changes while nobody is signed in", async () => {
    useWorkoutTemplatesStore
      .getState()
      .addTemplate({ name: "Orphan", exercises });
    await settle();

    expect(templateNames()).toEqual([]);
    expect(mockStorage.__INTERNAL_MOCK_STORAGE__).toEqual({});
  });

  it("keeps ownerless legacy templates quarantined, whatever their timestamp", async () => {
    // Account B's template, stamped in the future by a skewed device clock.
    const legacy = JSON.stringify({
      state: { templates: [template("b", Date.now() + 86_400_000)] },
      version: 0,
    });
    await AsyncStorage.setItem(LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY, legacy);

    await signIn("user-a");
    useWorkoutTemplatesStore
      .getState()
      .addTemplate({ name: "Push day", exercises });
    await settle();

    expect(templateNames()).toEqual(["Push day"]);
    expect(storedTemplates("user-a")).toMatchObject({
      templates: [{ name: "Push day" }],
    });
    expect(
      mockStorage.__INTERNAL_MOCK_STORAGE__[
        LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY
      ]
    ).toBe(legacy);
  });

  it("does not overwrite saved templates it could not read", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const saved = JSON.stringify({
      ownerUserId: "user-a",
      templates: [template("a")],
    });
    await AsyncStorage.setItem(workoutTemplatesStorageKey("user-a"), saved);
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("disk"));

    await signIn("user-a");
    useWorkoutTemplatesStore
      .getState()
      .addTemplate({ name: "Push day", exercises });
    await settle();

    expect(
      mockStorage.__INTERNAL_MOCK_STORAGE__[
        workoutTemplatesStorageKey("user-a")
      ]
    ).toBe(saved);

    // The next successful load saves normally again.
    await signIn(null);
    await signIn("user-a");
    expect(templateNames()).toEqual(["Template a"]);
    expect(warn).toHaveBeenCalled();
  });

  it("restores the account's templates after an app restart", async () => {
    await signIn("user-a");
    useWorkoutTemplatesStore
      .getState()
      .addTemplate({ name: "Push day", exercises });
    await settle();
    const disk = { ...mockStorage.__INTERNAL_MOCK_STORAGE__ };

    let restarted!: typeof useWorkoutTemplatesStore;
    jest.isolateModules(() => {
      // A fresh module registry, but the same data on disk.
      const storageModule = require("@react-native-async-storage/async-storage");
      const storage = (storageModule.default ??
        storageModule) as MockAsyncStorage;
      storage.__INTERNAL_MOCK_STORAGE__ = disk;
      restarted = require("../workout-templates-store")
        .useWorkoutTemplatesStore as typeof useWorkoutTemplatesStore;
    });

    expect(restarted.getState()).toMatchObject({
      ownerUserId: null,
      templates: [],
    });
    restarted.getState().setOwner("user-b");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(restarted.getState().templates).toEqual([]);

    restarted.getState().setOwner("user-a");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(restarted.getState().templates.map((t) => t.name)).toEqual([
      "Push day",
    ]);
  });

  describe("eraseWorkoutTemplatesForUser", () => {
    it("removes only the erased account's templates", async () => {
      await signIn("user-b");
      useWorkoutTemplatesStore
        .getState()
        .addTemplate({ name: "Leg day", exercises });
      await signIn("user-a");
      useWorkoutTemplatesStore
        .getState()
        .addTemplate({ name: "Push day", exercises });
      await settle();

      await eraseWorkoutTemplatesForUser("user-a");

      expect(templateNames()).toEqual([]);
      expect(storedTemplates("user-a")).toBeNull();
      expect(storedTemplates("user-b")).toMatchObject({
        templates: [{ name: "Leg day" }],
      });
    });

    it("stops a load in progress from bringing erased templates back", async () => {
      await AsyncStorage.setItem(
        workoutTemplatesStorageKey("user-a"),
        JSON.stringify({ ownerUserId: "user-a", templates: [template("a")] })
      );

      useWorkoutTemplatesStore.getState().setOwner("user-a");
      await eraseWorkoutTemplatesForUser("user-a");
      await settle();

      expect(templateNames()).toEqual([]);
      expect(storedTemplates("user-a")).toBeNull();
    });
  });
});
