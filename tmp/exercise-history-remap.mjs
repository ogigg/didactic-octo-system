import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const reportPath = "tmp/exercise-history-remap-report.json";

const manualNameMap = new Map([
  ["1 Leg Box Squat", "Box Squat"],
  ["1-Arm Half-Kneeling Lat Pulldown", "Single-Arm Lat Pulldown"],
  ["3008 Abdominal Crunch", "Crunch"],
  ["Ab wheel", "Ab Rollout"],
  ["Abdominal Crunch", "Crunch"],
  ["Abdominal Stabilization", "Plank"],
  ["Alternate back lunges", "Reverse Lunge"],
  ["Alternating High Cable Row", "Seated Cable Row"],
  ["Alternating dumbbell hammer curl", "Hammer Curl"],
  ["Alternative DB Gorilla rows", "One-Arm Dumbbell Row"],
  ["Archer Pull Up", "Pull-up"],
  ["Arm Raises (T/Y/I)", "Dumbbell Lateral Raise"],
  ["Assisted Pull-Up", "Assisted Pull-up"],
  ["Australian pull-ups", "Inverted Row"],
  ["Back extensión", "Back Extension"],
  ["Banded Clamshell", "Hip Abduction Machine"],
  ["Banded Shoulder Drills", "Face Pull"],
  ["Barbell Full Squat", "Barbell Back Squat"],
  ["Barbell Hip Thrust", "Hip Thrust"],
  ["Barbell Lunges Standing", "Front Squat"],
  ["Barbell Row (Overhand)", "Barbell Bent-Over Row"],
  ["Barbell Row (Underhand)", "Barbell Bent-Over Row"],
  ["Barbell Triceps Extension", "Machine Triceps Extension"],
  ["Bayesian Curl", "Cable Curl"],
  ["Bear crawl pull through", "Cable Pull-Through"],
  ["Bench Press", "Barbell Bench Press"],
  ["Bench Press Narrow Grip", "Close-Grip Bench Press"],
  ["Bent High Pulls", "Face Pull"],
  ["Bent Over Rowing Reverse", "Barbell Bent-Over Row"],
  ["Biceps Close Grip Pull Down", "Lat Pulldown"],
  ["Biceps Curl Machine", "Cable Curl"],
  ["Biceps Curls With Barbell", "Barbell Curl"],
  ["Bird Dog", "Bird Dog"],
  ["Bodyweight Squat HD", "Bodyweight Squat"],
  ["Bulgarian Squat with Dumbbells", "Bulgarian Split Squat"],
  ["Butterfly Narrow Grip", "Pec Deck Fly"],
  ["Butterfly Sit Up", "Crunch"],
  ["Cable Chest Press - Decline", "Decline Bench Press"],
  ["Cable Curls", "Cable Curl"],
  ["Cable Front Raise with a small bar", "Dumbbell Front Raise"],
  ["Cable Tricep Kickback", "Cable Triceps Pushdown"],
  ["Chest Press", "Machine Chest Press"],
  ["Crunches on Machine", "Cable Crunch"],
  ["Decline Bench Press Barbell", "Decline Bench Press"],
  ["Hammer Curls", "Hammer Curl"],
  ["Inverted Lat Pull Down", "Lat Pulldown"],
  ["Lat Pull Down", "Lat Pulldown"],
  ["Leg Curl", "Lying Leg Curl"],
  ["Leg Curls (sitting)", "Seated Leg Curl"],
  ["Leg Extension", "Leg Extension"],
  ["Leg Press", "Leg Press"],
  ["Machine Side Lateral Raises", "Dumbbell Lateral Raise"],
  ["Machine chest fly", "Pec Deck Fly"],
  ["Neutral Grip Lat Pulldown", "Lat Pulldown"],
  ["Pec Deck", "Pec Deck Fly"],
  ["Plank", "Plank"],
  ["Rotary Torso Machine", "Pallof Press"],
  ["Seated Dumbbell Curls", "Dumbbell Curl"],
  ["Seated Hip Adduction", "Hip Adduction Machine"],
  ["Seated Row (Machine)", "Machine Row"],
  ["Seated Triceps Press", "Seated Machine Triceps Press"],
  ["Shoulder Press, Dumbbells", "Dumbbell Shoulder Press"],
  ["Shoulder Press, on Machine", "Machine Shoulder Press"],
  ["Tricep Rope Pushdowns", "Cable Triceps Pushdown"],
  ["Triceps Pushdown", "Cable Triceps Pushdown"],
  ["Behind the Back Cable Lateral Raise", "Cable Lateral Raise"],
  ["bicycle crunches", "Bicycle Crunch"],
]);

function loadEnv(path) {
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional local env file.
  }
}

loadEnv("supabase/.env");
loadEnv("apps/mobile/.env");

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
}

const supabase = createClient(supabaseUrl.trim(), serviceKey.trim(), {
  auth: { persistSession: false },
});

async function fetchAll(table, select, options = {}) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (options.order) query = query.order(options.order.column, options.order.options);
    if (options.in) query = query.in(options.in.column, options.in.values);
    if (options.eq) query = query.eq(options.eq.column, options.eq.value);

    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(left|right|single|double|alternating|weighted|bodyweight)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(normalizeName(value).split(" ").filter(Boolean));
}

function jaccard(a, b) {
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

function overlapScore(oldExercise, newExercise) {
  const nameScore = jaccard(oldExercise.name, newExercise.name);
  const oldMuscles = new Set(oldExercise.primary_muscles ?? []);
  const newMuscles = new Set(newExercise.primary_muscles ?? []);
  const oldEquipment = new Set(oldExercise.equipment ?? []);
  const newEquipment = new Set(newExercise.equipment ?? []);

  let muscleOverlap = 0;
  for (const muscle of oldMuscles) {
    if (newMuscles.has(muscle)) muscleOverlap += 1;
  }

  let equipmentOverlap = 0;
  for (const equipment of oldEquipment) {
    if (newEquipment.has(equipment)) equipmentOverlap += 1;
  }

  return (
    nameScore * 0.7 +
    (muscleOverlap / Math.max(oldMuscles.size, newMuscles.size, 1)) * 0.2 +
    (equipmentOverlap / Math.max(oldEquipment.size, newEquipment.size, 1)) * 0.1
  );
}

function bestCandidates(oldExercise, activeExercises) {
  return activeExercises
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      external_id: exercise.external_id,
      score: Number(overlapScore(oldExercise, exercise).toFixed(4)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function chooseAutoMapping(oldExercise, candidates) {
  const normalizedOldName = normalizeName(oldExercise.name);
  const exact = candidates.find((candidate) => normalizeName(candidate.name) === normalizedOldName);
  if (exact) return exact;

  const [first, second] = candidates;
  if (!first) return null;
  if (first.score >= 0.82 && (!second || first.score - second.score >= 0.2)) return first;
  return null;
}

function manualMapping(oldExercise, activeExerciseByNormalizedName) {
  const mappedName = manualNameMap.get(oldExercise.name);
  if (!mappedName) return null;
  const exercise = activeExerciseByNormalizedName.get(normalizeName(mappedName));
  if (!exercise) {
    throw new Error(`Manual mapping target not found: ${oldExercise.name} -> ${mappedName}`);
  }

  return {
    id: exercise.id,
    name: exercise.name,
    external_id: exercise.external_id,
    score: 1,
    source: "manual",
  };
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function updateRow(table, id, values) {
  const { error } = await supabase.from(table).update(values).eq("id", id);
  if (error) throw new Error(`${table} ${id}: ${error.message}`);
}

function replaceExerciseIdsInJson(value, mappingByOldId) {
  if (Array.isArray(value)) {
    return value.map((item) => replaceExerciseIdsInJson(item, mappingByOldId));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        replaceExerciseIdsInJson(nestedValue, mappingByOldId),
      ]),
    );
  }

  if (typeof value === "string" && mappingByOldId.has(value)) {
    return mappingByOldId.get(value);
  }

  return value;
}

async function main() {
  const [
    profiles,
    exercises,
    workoutSessions,
    sessionExercises,
    exercisePreferences,
    pendingWorkouts,
  ] = await Promise.all([
    fetchAll("profiles", "id,created_at,onboarding_completed"),
    fetchAll(
      "exercises",
      "id,name,external_id,primary_muscles,equipment,catalog_status,retired_at,replacement_exercise_id",
      { order: { column: "name", options: { ascending: true } } },
    ),
    fetchAll("workout_sessions", "id,user_id,status,name,created_at,completed_at"),
    fetchAll("session_exercises", "id,workout_session_id,exercise_id,order_index"),
    fetchAll("exercise_preferences", "id,user_id,exercise_id,preference"),
    fetchAll("pending_workouts", "id,user_id,status,workout_data,created_at"),
  ]);

  const sessionIds = workoutSessions.map((session) => session.id);
  const relevantSessionExercises = sessionExercises.filter((row) =>
    sessionIds.includes(row.workout_session_id),
  );
  const sessionExerciseIds = relevantSessionExercises.map((row) => row.id);
  const sessionSets =
    sessionExerciseIds.length > 0
      ? await fetchAll("session_sets", "id,session_exercise_id,set_type", {
          in: { column: "session_exercise_id", values: sessionExerciseIds },
        })
      : [];
  const sessionSetIds = sessionSets.map((row) => row.id);
  const setLogs =
    sessionSetIds.length > 0
      ? await fetchAll("set_logs", "id,session_set_id,completed", {
          in: { column: "session_set_id", values: sessionSetIds },
        })
      : [];

  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const activeExercises = exercises.filter((exercise) => exercise.catalog_status === "active");
  const activeExerciseByNormalizedName = new Map(
    activeExercises.map((exercise) => [normalizeName(exercise.name), exercise]),
  );
  const retiredExercises = exercises.filter((exercise) => exercise.catalog_status === "retired");
  const sessionById = new Map(workoutSessions.map((session) => [session.id, session]));
  const setsBySessionExercise = countBy(sessionSets, (row) => row.session_exercise_id);
  const setIdToSessionExerciseId = new Map(
    sessionSets.map((set) => [set.id, set.session_exercise_id]),
  );
  const logsBySessionExercise = countBy(setLogs, (row) =>
    setIdToSessionExerciseId.get(row.session_set_id),
  );

  const usedExerciseIds = Array.from(
    new Set(relevantSessionExercises.map((row) => row.exercise_id)),
  );
  const oldUsedExerciseIds = usedExerciseIds.filter((id) => {
    const exercise = exerciseById.get(id);
    return !exercise || exercise.catalog_status !== "active";
  });

  const usage = oldUsedExerciseIds.map((id) => {
    const exercise = exerciseById.get(id);
    const rows = relevantSessionExercises.filter((row) => row.exercise_id === id);
    const candidates = exercise ? bestCandidates(exercise, activeExercises) : [];
    const manual = exercise ? manualMapping(exercise, activeExerciseByNormalizedName) : null;
    const auto = exercise ? chooseAutoMapping(exercise, candidates) : null;
    const chosen = manual ?? auto;

    return {
      old_exercise_id: id,
      old_name: exercise?.name ?? null,
      old_external_id: exercise?.external_id ?? null,
      old_catalog_status: exercise?.catalog_status ?? "missing",
      sessions: new Set(rows.map((row) => row.workout_session_id)).size,
      session_exercise_rows: rows.length,
      planned_sets: rows.reduce((sum, row) => sum + (setsBySessionExercise.get(row.id) ?? 0), 0),
      set_logs: rows.reduce((sum, row) => sum + (logsBySessionExercise.get(row.id) ?? 0), 0),
      candidates,
      auto_mapping: chosen
        ? {
            old_exercise_id: id,
            new_exercise_id: chosen.id,
            new_name: chosen.name,
            score: chosen.score,
            source: chosen.source ?? "auto",
          }
        : null,
    };
  });

  const autoMappings = usage
    .filter((row) => row.auto_mapping)
    .map((row) => row.auto_mapping);
  const mappingByOldId = new Map(
    autoMappings.map((mapping) => [mapping.old_exercise_id, mapping.new_exercise_id]),
  );

  const duplicateConflicts = [];
  const byWorkout = new Map();
  for (const row of relevantSessionExercises) {
    const mappedExerciseId = mappingByOldId.get(row.exercise_id) ?? row.exercise_id;
    const key = `${row.workout_session_id}:${mappedExerciseId}`;
    const existing = byWorkout.get(key);
    if (existing && existing.id !== row.id) {
      duplicateConflicts.push({
        workout_session_id: row.workout_session_id,
        mapped_exercise_id: mappedExerciseId,
        mapped_exercise_name: exerciseById.get(mappedExerciseId)?.name ?? null,
        first_session_exercise_id: existing.id,
        first_old_exercise_id: existing.exercise_id,
        first_old_exercise_name: exerciseById.get(existing.exercise_id)?.name ?? null,
        second_session_exercise_id: row.id,
        second_old_exercise_id: row.exercise_id,
        second_old_exercise_name: exerciseById.get(row.exercise_id)?.name ?? null,
      });
    } else {
      byWorkout.set(key, row);
    }
  }

  const pendingWorkoutHits = pendingWorkouts
    .map((row) => {
      const serialized = JSON.stringify(row.workout_data ?? {});
      const hits = oldUsedExerciseIds.filter((id) => serialized.includes(id));
      return hits.length > 0
        ? {
            id: row.id,
            user_id: row.user_id,
            status: row.status,
            old_exercise_ids: hits,
          }
        : null;
    })
    .filter(Boolean);

  const preferenceRowsToMap = exercisePreferences.filter((row) => mappingByOldId.has(row.exercise_id));

  const report = {
    generated_at: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    summary: {
      profiles: profiles.length,
      workout_sessions: workoutSessions.length,
      completed_workout_sessions: workoutSessions.filter((session) => session.status === "completed")
        .length,
      exercises_total: exercises.length,
      exercises_active: activeExercises.length,
      exercises_retired: retiredExercises.length,
      used_exercises: usedExerciseIds.length,
      used_old_or_missing_exercises: oldUsedExerciseIds.length,
      auto_mapped_old_exercises: autoMappings.length,
      unmapped_old_exercises: usage.filter((row) => !row.auto_mapping).length,
      session_exercise_rows_to_update: relevantSessionExercises.filter((row) =>
        mappingByOldId.has(row.exercise_id),
      ).length,
      set_logs_behind_rows_to_update: relevantSessionExercises
        .filter((row) => mappingByOldId.has(row.exercise_id))
        .reduce((sum, row) => sum + (logsBySessionExercise.get(row.id) ?? 0), 0),
      exercise_preferences_to_map: preferenceRowsToMap.length,
      pending_workouts_with_old_ids: pendingWorkoutHits.length,
      duplicate_conflicts: duplicateConflicts.length,
    },
    old_exercise_usage: usage,
    duplicate_conflicts: duplicateConflicts,
    pending_workout_hits: pendingWorkoutHits,
    exercise_preferences_to_map: preferenceRowsToMap.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      old_exercise_id: row.exercise_id,
      new_exercise_id: mappingByOldId.get(row.exercise_id),
      preference: row.preference,
    })),
  };

  if (apply) {
    if (report.summary.unmapped_old_exercises > 0) {
      throw new Error("Refusing to apply: some old exercises are unmapped.");
    }
    if (duplicateConflicts.length > 0) {
      throw new Error("Refusing to apply: duplicate exercise conflicts detected.");
    }
    if (pendingWorkoutHits.length > 0) {
      const unreplaceablePendingHits = pendingWorkoutHits.filter((row) =>
        row.old_exercise_ids.some((id) => !mappingByOldId.has(id)),
      );
      if (unreplaceablePendingHits.length > 0) {
        throw new Error("Refusing to apply: pending workouts contain unmapped old exercise IDs.");
      }
    }

    for (const row of relevantSessionExercises) {
      const newExerciseId = mappingByOldId.get(row.exercise_id);
      if (newExerciseId) {
        await updateRow("session_exercises", row.id, { exercise_id: newExerciseId });
      }
    }

    for (const row of preferenceRowsToMap) {
      const newExerciseId = mappingByOldId.get(row.exercise_id);
      const existing = exercisePreferences.find(
        (preference) =>
          preference.user_id === row.user_id && preference.exercise_id === newExerciseId,
      );
      if (existing) {
        await updateRow("exercise_preferences", existing.id, { preference: row.preference });
        const { error } = await supabase.from("exercise_preferences").delete().eq("id", row.id);
        if (error) throw new Error(`exercise_preferences ${row.id}: ${error.message}`);
      } else {
        await updateRow("exercise_preferences", row.id, { exercise_id: newExerciseId });
      }
    }

    for (const mapping of autoMappings) {
      await updateRow("exercises", mapping.old_exercise_id, {
        replacement_exercise_id: mapping.new_exercise_id,
      });
    }

    for (const row of pendingWorkouts) {
      const updatedWorkoutData = replaceExerciseIdsInJson(row.workout_data, mappingByOldId);
      if (JSON.stringify(updatedWorkoutData) !== JSON.stringify(row.workout_data)) {
        await updateRow("pending_workouts", row.id, { workout_data: updatedWorkoutData });
      }
    }

    report.applied = {
      session_exercise_rows_updated: report.summary.session_exercise_rows_to_update,
      exercise_preferences_mapped: report.summary.exercise_preferences_to_map,
      replacement_links_set: autoMappings.length,
      pending_workouts_rewritten: pendingWorkoutHits.length,
    };
  }

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
