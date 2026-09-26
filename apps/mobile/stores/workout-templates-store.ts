import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import { create } from "zustand";

export interface WorkoutTemplateExercise {
  id: string;
  name: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: WorkoutTemplateExercise[];
  createdAt: number;
}

interface WorkoutTemplatesState {
  /** Account whose templates are loaded. Null while nobody is signed in. */
  ownerUserId: string | null;
  templates: WorkoutTemplate[];
  /** True once the owner's saved templates have been loaded. */
  hasHydrated: boolean;
}

interface WorkoutTemplatesActions {
  /**
   * Shows only this account's templates. Clears the previous account's
   * templates from memory at once, then loads the new account's from storage.
   */
  setOwner: (userId: string | null) => void;
  addTemplate: (template: Omit<WorkoutTemplate, "id" | "createdAt">) => void;
  removeTemplate: (id: string) => void;
  updateTemplate: (
    id: string,
    updates: Partial<Pick<WorkoutTemplate, "name" | "exercises">>
  ) => void;
}

/**
 * Shared templates from before per-account storage. Nothing records which
 * account made them, so they are quarantined: never read, claimed or deleted.
 */
export const LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY = "workout-templates-storage";

export function workoutTemplatesStorageKey(userId: string): string {
  return `${LEGACY_WORKOUT_TEMPLATES_STORAGE_KEY}:${userId}`;
}

const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  exercises: z.array(z.object({ id: z.string().min(1), name: z.string() })),
  createdAt: z.number(),
});

const ownedTemplatesSchema = z.object({
  ownerUserId: z.string().min(1),
  templates: z.array(z.unknown()),
});

function parseTemplates(entries: unknown[]): WorkoutTemplate[] {
  return entries.flatMap((entry) => {
    const result = templateSchema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseOwnedTemplates(
  raw: string | null,
  userId: string
): WorkoutTemplate[] {
  if (raw === null) return [];
  const result = ownedTemplatesSchema.safeParse(parseJson(raw));
  // A record naming another account is never shown, whatever its key.
  if (!result.success || result.data.ownerUserId !== userId) {
    console.warn("[workout-templates-store] ignoring unreadable templates");
    return [];
  }
  return parseTemplates(result.data.templates);
}

function mergeTemplates(...lists: WorkoutTemplate[][]): WorkoutTemplate[] {
  const seen = new Set<string>();
  return lists.flat().filter((template) => {
    if (seen.has(template.id)) return false;
    seen.add(template.id);
    return true;
  });
}

// Bumped on every owner change so a slow load cannot restore another
// account's templates after the switch.
let ownerGeneration = 0;
// Set when the owner's saved templates could not be read. Saving then could
// overwrite them, so changes stay in memory until the next successful load.
let saveBlocked = false;
let storageTail: Promise<void> = Promise.resolve();

function queueStorageWrite(write: () => Promise<void>): Promise<void> {
  storageTail = storageTail.then(write).catch((error: unknown) => {
    console.warn("[workout-templates-store] storage write failed:", error);
  });
  return storageTail;
}

function saveTemplates(
  userId: string,
  templates: WorkoutTemplate[]
): Promise<void> {
  const value = JSON.stringify({ ownerUserId: userId, templates });
  return queueStorageWrite(() =>
    AsyncStorage.setItem(workoutTemplatesStorageKey(userId), value)
  );
}

async function loadTemplates(userId: string, generation: number) {
  let saved: WorkoutTemplate[] = [];
  let readFailed = false;
  try {
    // Read after queued writes, so switching back shows the latest save.
    await storageTail;
    saved = parseOwnedTemplates(
      await AsyncStorage.getItem(workoutTemplatesStorageKey(userId)),
      userId
    );
  } catch (error) {
    readFailed = true;
    console.warn("[workout-templates-store] loading templates failed:", error);
  }

  // Another account (or sign-out) took over while this was loading.
  if (generation !== ownerGeneration) return;

  saveBlocked = readFailed;
  const unsaved = useWorkoutTemplatesStore.getState().templates;
  const templates = mergeTemplates(unsaved, saved);
  useWorkoutTemplatesStore.setState({ templates, hasHydrated: true });

  if (unsaved.length > 0 && !saveBlocked) {
    void saveTemplates(userId, templates);
  }
}

/**
 * Removes an account's saved templates from this device, for confirmed
 * account erasure. Signing out keeps them for the account's next sign-in.
 */
export function eraseWorkoutTemplatesForUser(userId: string): Promise<void> {
  if (useWorkoutTemplatesStore.getState().ownerUserId === userId) {
    ownerGeneration += 1;
    saveBlocked = false;
    useWorkoutTemplatesStore.setState({ templates: [], hasHydrated: true });
  }
  return queueStorageWrite(() =>
    AsyncStorage.removeItem(workoutTemplatesStorageKey(userId))
  );
}

/** Resolves once every queued template write has reached storage. */
export function waitForWorkoutTemplatesPersistence(): Promise<void> {
  return storageTail;
}

export const useWorkoutTemplatesStore = create<
  WorkoutTemplatesState & WorkoutTemplatesActions
>()((set, get) => {
  function commit(update: (templates: WorkoutTemplate[]) => WorkoutTemplate[]) {
    const { ownerUserId, templates, hasHydrated } = get();
    if (!ownerUserId) return;
    const next = update(templates);
    set({ templates: next });
    // Before loading finishes, the load merges and saves these changes.
    if (hasHydrated && !saveBlocked) void saveTemplates(ownerUserId, next);
  }

  return {
    ownerUserId: null,
    templates: [],
    hasHydrated: false,

    setOwner: (userId) => {
      if (get().ownerUserId === userId) return;
      const generation = ++ownerGeneration;
      saveBlocked = false;
      set({ ownerUserId: userId, templates: [], hasHydrated: false });
      if (userId) void loadTemplates(userId, generation);
    },

    addTemplate: (template) =>
      commit((templates) => [
        { id: `template-${Date.now()}`, createdAt: Date.now(), ...template },
        ...templates,
      ]),

    removeTemplate: (id) =>
      commit((templates) => templates.filter((t) => t.id !== id)),

    updateTemplate: (id, updates) =>
      commit((templates) =>
        templates.map((t) => (t.id === id ? { ...t, ...updates } : t))
      ),
  };
});
