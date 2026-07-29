"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackIcon,
  CheckIcon,
  ForwardIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  TrophyIcon,
  UndoIcon,
  WatchShell,
  formatTime,
} from "./watch-ui";

export interface FinalScreenOption {
  id:
    | "final-list"
    | "final-active"
    | "final-rest"
    | "final-heart"
    | "final-exercise-done"
    | "final-workout-done";
  number: string;
  name: string;
  summary: string;
  canvasNote: string;
}

export type FinalScreenId = FinalScreenOption["id"];

export const FINAL_SCREENS: FinalScreenOption[] = [
  {
    id: "final-list",
    number: "A",
    name: "Exercise list",
    summary: "The whole session with done, current and upcoming states.",
    canvasNote:
      "Seven exercises, crown-scrollable, each keeping its own logged sets.",
  },
  {
    id: "final-active",
    number: "B",
    name: "Active workout",
    summary: "The prescription, the editable set, and the log action.",
    canvasNote:
      "Target and last-time performance stay visible while you edit reps or load.",
  },
  {
    id: "final-rest",
    number: "C",
    name: "Rest timer",
    summary: "Recovery with an explicit finish action.",
    canvasNote:
      "Pause is visible, skipping asks for confirmation, and zero shows Start set.",
  },
  {
    id: "final-heart",
    number: "D",
    name: "Heart rate",
    summary: "Recovery readiness, not just a number.",
    canvasNote:
      "Pulse cadence follows the simulated BPM and reacts to the workout state.",
  },
  {
    id: "final-exercise-done",
    number: "E",
    name: "Exercise complete",
    summary: "The close-out state for a finished exercise.",
    canvasNote: "Volume, duration, personal records, and the next exercise.",
  },
  {
    id: "final-workout-done",
    number: "F",
    name: "Workout complete",
    summary: "The end-of-session summary.",
    canvasNote: "Session totals with a reset so the flow can be replayed.",
  },
];

interface ExercisePlan {
  id: string;
  name: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  restSeconds: number;
  lastReps: number;
  lastWeight: number;
  bestWeight: number;
  bestReps: number;
}

const EXERCISE_PLANS: ExercisePlan[] = [
  {
    id: "bench-press",
    name: "Bench Press",
    targetSets: 4,
    targetReps: 8,
    targetWeight: 42.5,
    restSeconds: 90,
    lastReps: 8,
    lastWeight: 40,
    bestWeight: 42.5,
    bestReps: 7,
  },
  {
    id: "incline-dumbbell-press",
    name: "Incline Dumbbell Press",
    targetSets: 3,
    targetReps: 10,
    targetWeight: 22.5,
    restSeconds: 90,
    lastReps: 10,
    lastWeight: 20,
    bestWeight: 22.5,
    bestReps: 9,
  },
  {
    id: "seated-shoulder-press",
    name: "Seated Shoulder Press",
    targetSets: 4,
    targetReps: 8,
    targetWeight: 30,
    restSeconds: 90,
    lastReps: 8,
    lastWeight: 30,
    bestWeight: 30,
    bestReps: 8,
  },
  {
    id: "cable-fly",
    name: "Cable Fly",
    targetSets: 3,
    targetReps: 12,
    targetWeight: 15,
    restSeconds: 60,
    lastReps: 12,
    lastWeight: 15,
    bestWeight: 15,
    bestReps: 12,
  },
  {
    id: "lateral-raise",
    name: "Lateral Raise",
    targetSets: 3,
    targetReps: 15,
    targetWeight: 10,
    restSeconds: 60,
    lastReps: 14,
    lastWeight: 10,
    bestWeight: 10,
    bestReps: 15,
  },
  {
    id: "overhead-cable-triceps-extension",
    name: "Überkopf-Trizepsdrücken am Kabel",
    targetSets: 3,
    targetReps: 12,
    targetWeight: 17.5,
    restSeconds: 60,
    lastReps: 12,
    lastWeight: 15,
    bestWeight: 17.5,
    bestReps: 10,
  },
  {
    id: "triceps-pressdown",
    name: "Triceps Pressdown",
    targetSets: 3,
    targetReps: 12,
    targetWeight: 20,
    restSeconds: 60,
    lastReps: 12,
    lastWeight: 20,
    bestWeight: 22.5,
    bestReps: 8,
  },
];

interface LoggedSet {
  reps: number;
  weight: number;
  isPersonalRecord: boolean;
}

interface ExerciseProgress {
  reps: number;
  weight: number;
  seconds: number;
  sets: LoggedSet[];
}

type ProgressMap = Record<string, ExerciseProgress>;

interface RestState {
  remaining: number;
  total: number;
  running: boolean;
}

interface LogSnapshot {
  exerciseId: string;
  progress: ExerciseProgress;
  rest: RestState;
  screen: FinalScreenId;
  heartRateAtLastSet: number;
}

interface ToastState {
  key: number;
  message: string;
  tone: "success" | "record" | "neutral";
  undoable: boolean;
}

const HEART_TARGETS = {
  working: 142,
  resting: 101,
  paused: 88,
  reviewing: 116,
  finished: 82,
} as const;

const RECOVERED_BPM = 112;
const WEIGHT_STEP = 2.5;
const REST_STEP = 15;
const CROWN_REST_STEP = 5;
const SEED_ELAPSED = 612;

function createProgress(): ProgressMap {
  return EXERCISE_PLANS.reduce<ProgressMap>((accumulator, plan) => {
    accumulator[plan.id] = {
      reps: plan.targetReps,
      weight: plan.targetWeight,
      seconds: 0,
      sets: [],
    };
    return accumulator;
  }, {});
}

/** A partially finished session so the prototype opens mid-workout. */
function seedProgress(): ProgressMap {
  const seeded = createProgress();
  seeded["bench-press"] = {
    reps: 8,
    weight: 42.5,
    seconds: 371,
    sets: [
      { reps: 8, weight: 42.5, isPersonalRecord: false },
      { reps: 8, weight: 42.5, isPersonalRecord: false },
    ],
  };
  return seeded;
}

function roundWeight(value: number) {
  return Number(value.toFixed(2));
}

function volumeOf(sets: LoggedSet[]) {
  return sets.reduce((total, set) => total + set.reps * set.weight, 0);
}

function formatVolume(kilograms: number) {
  if (kilograms >= 1000) return `${(kilograms / 1000).toFixed(1)}t`;
  return `${Math.round(kilograms)} kg`;
}

function heartZone(bpm: number) {
  if (bpm >= 155) return "PEAK";
  if (bpm >= 135) return "HARD";
  if (bpm >= 115) return "MODERATE";
  if (bpm >= 100) return "LIGHT";
  return "RECOVERED";
}

interface HeartChipProps {
  bpm: number;
  onOpen: () => void;
}

function HeartChip({ bpm, onOpen }: HeartChipProps) {
  return (
    <button
      type="button"
      className="final-heart-chip"
      onClick={onOpen}
      aria-label={`Heart rate ${bpm} beats per minute. Open heart rate.`}
    >
      <span
        className="final-heart-chip-icon"
        style={{ animationDuration: `${(60 / Math.max(bpm, 40)).toFixed(2)}s` }}
      >
        <HeartIcon />
      </span>
      {bpm}
    </button>
  );
}

interface FinalFlowProps {
  screenId: FinalScreenId;
  onNavigate: (screen: FinalScreenId) => void;
}

export function FinalFlow({ screenId, onNavigate }: FinalFlowProps) {
  const [activeExerciseId, setActiveExerciseId] = useState(
    EXERCISE_PLANS[0].id
  );
  const [progress, setProgress] = useState<ProgressMap>(seedProgress);
  const [metric, setMetric] = useState<"reps" | "weight">("reps");
  const [rest, setRest] = useState<RestState>({
    remaining: 67,
    total: 90,
    running: true,
  });
  const [elapsed, setElapsed] = useState(SEED_ELAPSED);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  const [heartRate, setHeartRate] = useState(126);
  const [heartRateAtLastSet, setHeartRateAtLastSet] = useState(148);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [skipArmed, setSkipArmed] = useState(false);
  const [endArmed, setEndArmed] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);

  const undoRef = useRef<LogSnapshot | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const heartReturnRef = useRef<FinalScreenId>("final-active");
  const toastCounter = useRef(0);

  useEffect(() => {
    if (screenId !== "final-heart") {
      heartReturnRef.current = screenId;
    }
  }, [screenId]);

  useEffect(() => {
    setSkipArmed(false);
    setEndArmed(false);
  }, [screenId]);

  const activePlan =
    EXERCISE_PLANS.find((plan) => plan.id === activeExerciseId) ??
    EXERCISE_PLANS[0];
  const activeProgress = progress[activePlan.id];
  const loggedSets = activeProgress.sets.length;
  const exerciseDone = loggedSets >= activePlan.targetSets;
  const currentSetNumber = Math.min(loggedSets + 1, activePlan.targetSets);
  const sessionDone = useMemo(
    () =>
      EXERCISE_PLANS.every(
        (plan) => progress[plan.id].sets.length >= plan.targetSets
      ),
    [progress]
  );
  const finishedCount = EXERCISE_PLANS.filter(
    (plan) => progress[plan.id].sets.length >= plan.targetSets
  ).length;

  const nextPlan = useMemo(() => {
    const startIndex = EXERCISE_PLANS.findIndex(
      (plan) => plan.id === activePlan.id
    );
    for (let step = 1; step <= EXERCISE_PLANS.length; step += 1) {
      const candidate =
        EXERCISE_PLANS[(startIndex + step) % EXERCISE_PLANS.length];
      if (progress[candidate.id].sets.length < candidate.targetSets) {
        return candidate;
      }
    }
    return null;
  }, [activePlan.id, progress]);

  const heartTarget = workoutFinished
    ? HEART_TARGETS.finished
    : isPaused
      ? HEART_TARGETS.paused
      : rest.running || screenId === "final-rest"
        ? HEART_TARGETS.resting
        : screenId === "final-active"
          ? HEART_TARGETS.working
          : HEART_TARGETS.reviewing;

  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    tickRef.current = () => {
      setHeartRate((current) => {
        const drift = current > heartTarget ? -2 : 2;
        const jitter = Math.round((Math.random() - 0.5) * 3);
        const next = current + drift + jitter;
        if (drift < 0) return Math.max(heartTarget - 2, next);
        return Math.min(heartTarget + 2, next);
      });

      if (workoutFinished || isPaused) return;

      setElapsed((current) => current + 1);
      if (!exerciseDone) {
        setProgress((current) => ({
          ...current,
          [activePlan.id]: {
            ...current[activePlan.id],
            seconds: current[activePlan.id].seconds + 1,
          },
        }));
      }

      if (rest.running && rest.remaining > 0) {
        const remaining = rest.remaining - 1;
        setRest({ ...rest, remaining, running: remaining > 0 });
        if (remaining <= 0) {
          setAnnouncement("Rest complete. Ready for the next set.");
        }
      }
    };
  });

  useEffect(() => {
    const interval = window.setInterval(() => tickRef.current(), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!skipArmed) return;
    const timeout = window.setTimeout(() => setSkipArmed(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [skipArmed]);

  useEffect(() => {
    if (!endArmed) return;
    const timeout = window.setTimeout(() => setEndArmed(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [endArmed]);

  const showToast = useCallback(
    (message: string, tone: ToastState["tone"], undoable = false) => {
      toastCounter.current += 1;
      setToast({ key: toastCounter.current, message, tone, undoable });
      setAnnouncement(message);
    },
    []
  );

  const updateActive = useCallback(
    (patch: Partial<ExerciseProgress>) => {
      setProgress((current) => ({
        ...current,
        [activePlan.id]: { ...current[activePlan.id], ...patch },
      }));
    },
    [activePlan.id]
  );

  const nudgeMetric = useCallback(
    (direction: 1 | -1) => {
      if (exerciseDone) return;
      if (metric === "reps") {
        updateActive({
          reps: Math.min(99, Math.max(0, activeProgress.reps + direction)),
        });
      } else {
        updateActive({
          weight: Math.min(
            500,
            Math.max(
              0,
              roundWeight(activeProgress.weight + direction * WEIGHT_STEP)
            )
          ),
        });
      }
    },
    [
      activeProgress.reps,
      activeProgress.weight,
      exerciseDone,
      metric,
      updateActive,
    ]
  );

  const startRest = useCallback((seconds: number) => {
    setRest({ remaining: seconds, total: seconds, running: true });
  }, []);

  const logSet = useCallback(() => {
    if (exerciseDone) return;
    const isPersonalRecord =
      activeProgress.weight > activePlan.bestWeight ||
      (activeProgress.weight === activePlan.bestWeight &&
        activeProgress.reps > activePlan.bestReps);

    undoRef.current = {
      exerciseId: activePlan.id,
      progress: activeProgress,
      rest,
      screen: "final-active",
      heartRateAtLastSet,
    };

    const nextSets = [
      ...activeProgress.sets,
      {
        reps: activeProgress.reps,
        weight: activeProgress.weight,
        isPersonalRecord,
      },
    ];
    updateActive({ sets: nextSets });
    setHeartRateAtLastSet(heartRate);

    const finishedExercise = nextSets.length >= activePlan.targetSets;
    if (finishedExercise) {
      setRest({ remaining: 0, total: activePlan.restSeconds, running: false });
      onNavigate("final-exercise-done");
    } else {
      startRest(activePlan.restSeconds);
      onNavigate("final-rest");
    }

    showToast(
      isPersonalRecord
        ? `New PR · ${activeProgress.reps} × ${activeProgress.weight} kg`
        : `Set ${nextSets.length} logged · ${activeProgress.reps} × ${activeProgress.weight} kg`,
      isPersonalRecord ? "record" : "success",
      true
    );
  }, [
    activePlan,
    activeProgress,
    exerciseDone,
    heartRate,
    heartRateAtLastSet,
    onNavigate,
    rest,
    showToast,
    startRest,
    updateActive,
  ]);

  const undoLastSet = useCallback(() => {
    const snapshot = undoRef.current;
    if (!snapshot) return;
    undoRef.current = null;
    setProgress((current) => ({
      ...current,
      [snapshot.exerciseId]: {
        ...snapshot.progress,
        seconds: current[snapshot.exerciseId].seconds,
      },
    }));
    setActiveExerciseId(snapshot.exerciseId);
    setRest(snapshot.rest);
    setHeartRateAtLastSet(snapshot.heartRateAtLastSet);
    setToast(null);
    setAnnouncement("Last set removed.");
    onNavigate(snapshot.screen);
  }, [onNavigate]);

  const selectExercise = useCallback(
    (planId: string) => {
      setActiveExerciseId(planId);
      const target = EXERCISE_PLANS.find((plan) => plan.id === planId);
      const done = target && progress[planId].sets.length >= target.targetSets;
      onNavigate(done ? "final-exercise-done" : "final-active");
    },
    [onNavigate, progress]
  );

  const resetSession = useCallback(() => {
    setProgress(createProgress());
    setActiveExerciseId(EXERCISE_PLANS[0].id);
    setRest({
      remaining: 0,
      total: EXERCISE_PLANS[0].restSeconds,
      running: false,
    });
    setElapsed(0);
    setIsPaused(false);
    setWorkoutFinished(false);
    setHeartRate(96);
    setHeartRateAtLastSet(96);
    setToast(null);
    setAnnouncement("New session ready.");
    onNavigate("final-list");
  }, [onNavigate]);

  const endWorkout = useCallback(() => {
    setPauseSheetOpen(false);
    setIsPaused(false);
    setWorkoutFinished(true);
    setRest((current) => ({ ...current, running: false }));
    onNavigate("final-workout-done");
  }, [onNavigate]);

  const totalVolume = useMemo(
    () =>
      EXERCISE_PLANS.reduce(
        (total, plan) => total + volumeOf(progress[plan.id].sets),
        0
      ),
    [progress]
  );
  const totalSets = useMemo(
    () =>
      EXERCISE_PLANS.reduce(
        (total, plan) => total + progress[plan.id].sets.length,
        0
      ),
    [progress]
  );
  const totalRecords = useMemo(
    () =>
      EXERCISE_PLANS.reduce(
        (total, plan) =>
          total +
          progress[plan.id].sets.filter((set) => set.isPersonalRecord).length,
        0
      ),
    [progress]
  );

  const crownHandler = useMemo(() => {
    if (screenId === "final-active") {
      return (direction: 1 | -1) => nudgeMetric(direction);
    }
    if (screenId === "final-list") {
      return (direction: 1 | -1) => {
        listRef.current?.scrollBy({
          top: direction * -64,
          behavior: "smooth",
        });
      };
    }
    if (screenId === "final-rest") {
      return (direction: 1 | -1) => {
        setRest((current) => ({
          ...current,
          remaining: Math.max(
            0,
            Math.min(600, current.remaining + direction * CROWN_REST_STEP)
          ),
          total: Math.max(
            current.total,
            current.remaining + direction * CROWN_REST_STEP
          ),
        }));
      };
    }
    return undefined;
  }, [nudgeMetric, screenId]);

  const crownLabel =
    screenId === "final-active"
      ? `Digital Crown adjusts ${metric === "reps" ? "reps" : "load"}`
      : screenId === "final-list"
        ? "Digital Crown scrolls the exercise list"
        : screenId === "final-rest"
          ? "Digital Crown adjusts rest time"
          : "Digital Crown";

  const openHeart = () => onNavigate("final-heart");

  const backButton = (label: string, target: FinalScreenId) => (
    <button
      type="button"
      className="final-back"
      onClick={() => onNavigate(target)}
      aria-label={label}
    >
      <BackIcon />
      <span>{target === "final-list" ? "Session" : "Back"}</span>
    </button>
  );

  const leading = (() => {
    switch (screenId) {
      case "final-active":
      case "final-exercise-done":
        return backButton("Back to exercise list", "final-list");
      case "final-rest":
        return backButton("Back to the active set", "final-active");
      case "final-heart":
        return backButton("Back", heartReturnRef.current);
      case "final-workout-done":
        return <span className="final-status-title">Summary</span>;
      default:
        return <span className="final-status-title">Push day</span>;
    }
  })();

  const restProgress = rest.total
    ? Math.max(0, Math.min(100, (rest.remaining / rest.total) * 100))
    : 0;
  const recovered = heartRate <= RECOVERED_BPM;
  const recoveryDrop = Math.max(0, heartRateAtLastSet - heartRate);

  const renderList = () => (
    <>
      <div className="final-context">
        <span className="final-context-label">
          {finishedCount}/{EXERCISE_PLANS.length} done · {formatTime(elapsed)}
        </span>
        <HeartChip bpm={heartRate} onOpen={openHeart} />
      </div>

      <div className="final-scroll" ref={listRef}>
        <ul className="final-list" aria-label="Session exercises">
          {EXERCISE_PLANS.map((plan, index) => {
            const sets = progress[plan.id].sets.length;
            const done = sets >= plan.targetSets;
            const isCurrent = plan.id === activePlan.id && !done;
            const state = done ? "done" : isCurrent ? "current" : "upcoming";
            return (
              <li key={plan.id}>
                <button
                  type="button"
                  className={`final-list-item ${state}`}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => selectExercise(plan.id)}
                >
                  <span className="final-list-mark">
                    {done ? <CheckIcon /> : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="final-list-copy">
                    <strong>{plan.name}</strong>
                    <small>
                      {plan.targetSets} × {plan.targetReps} ·{" "}
                      {plan.targetWeight} kg
                    </small>
                  </span>
                  <span className="final-list-state">
                    {done ? "DONE" : `${sets}/${plan.targetSets}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          className={`final-list-finish ${sessionDone ? "ready" : ""} ${
            endArmed ? "armed" : ""
          }`}
          onClick={() => {
            if (sessionDone || endArmed) {
              endWorkout();
              return;
            }
            setEndArmed(true);
            setAnnouncement("Tap again to end the workout early.");
          }}
        >
          {sessionDone
            ? "Finish workout"
            : endArmed
              ? "Tap again to end early"
              : "End workout"}
        </button>
      </div>
    </>
  );

  const renderActive = () => (
    <>
      <div className="final-context">
        <span className="final-context-label">
          SET {currentSetNumber} OF {activePlan.targetSets}
        </span>
        <HeartChip bpm={heartRate} onOpen={openHeart} />
      </div>

      <div className="final-scroll">
        <h2 className="final-exercise-name">{activePlan.name}</h2>

        <div className="final-plan-strip">
          <span>
            <small>TARGET</small>
            <strong>
              {activePlan.targetReps} × {activePlan.targetWeight} kg
            </strong>
          </span>
          <span>
            <small>LAST TIME</small>
            <strong>
              {activePlan.lastReps} × {activePlan.lastWeight} kg
            </strong>
          </span>
        </div>

        {exerciseDone ? (
          <button
            type="button"
            className="final-primary success"
            onClick={() => onNavigate("final-exercise-done")}
          >
            <CheckIcon />
            All sets done
          </button>
        ) : (
          <>
            <div className="final-editor">
              <button
                type="button"
                className="final-step"
                aria-label={
                  metric === "reps" ? "Decrease reps" : "Decrease load"
                }
                onClick={() => nudgeMetric(-1)}
              >
                −
              </button>
              <p
                className="final-editor-value"
                aria-live="polite"
                aria-atomic="true"
              >
                <strong>
                  {metric === "reps"
                    ? activeProgress.reps
                    : activeProgress.weight}
                </strong>
                <span>{metric === "reps" ? "REPS" : "KG"}</span>
              </p>
              <button
                type="button"
                className="final-step increase"
                aria-label={
                  metric === "reps" ? "Increase reps" : "Increase load"
                }
                onClick={() => nudgeMetric(1)}
              >
                +
              </button>
            </div>

            <div
              className="final-metric-toggle"
              role="group"
              aria-label="Choose the value the crown and steppers edit"
            >
              <button
                type="button"
                className={metric === "reps" ? "active" : ""}
                aria-pressed={metric === "reps"}
                onClick={() => setMetric("reps")}
              >
                <small>REPS</small>
                <strong>{activeProgress.reps}</strong>
              </button>
              <button
                type="button"
                className={metric === "weight" ? "active" : ""}
                aria-pressed={metric === "weight"}
                onClick={() => setMetric("weight")}
              >
                <small>LOAD KG</small>
                <strong>{activeProgress.weight}</strong>
              </button>
            </div>

            <div className="final-action-row">
              <button
                type="button"
                className="final-icon-button"
                onClick={() => setPauseSheetOpen(true)}
                aria-label="Pause workout"
              >
                <PauseIcon />
              </button>
              <button type="button" className="final-primary" onClick={logSet}>
                <CheckIcon />
                Log set
              </button>
            </div>
          </>
        )}

        <ul className="final-logged" aria-label="Logged sets">
          {Array.from({ length: activePlan.targetSets }, (_, index) => {
            const set = activeProgress.sets[index];
            return (
              <li
                key={index}
                className={
                  set
                    ? set.isPersonalRecord
                      ? "logged record"
                      : "logged"
                    : index === loggedSets
                      ? "next"
                      : ""
                }
              >
                <span>{index + 1}</span>
                <strong>
                  {set
                    ? `${set.reps} × ${set.weight} kg`
                    : `${activePlan.targetReps} × ${activePlan.targetWeight} kg`}
                </strong>
                {set?.isPersonalRecord ? <em>PR</em> : null}
                {!set && index === loggedSets ? (
                  <em className="up">NOW</em>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="final-footnote">
          Rest {formatTime(activePlan.restSeconds)} · this exercise{" "}
          {formatTime(activeProgress.seconds)}
        </p>
      </div>
    </>
  );

  const renderRest = () => (
    <>
      <div className="final-context">
        <span className="final-context-label">
          {rest.remaining > 0 ? "REST" : "REST DONE"} · NEXT SET{" "}
          {currentSetNumber}
        </span>
        <HeartChip bpm={heartRate} onOpen={openHeart} />
      </div>

      <div className="final-scroll">
        <p className="final-countdown" aria-live="off">
          <strong>{formatTime(rest.remaining)}</strong>
          <span className={rest.running ? "" : "held"}>
            {rest.remaining === 0
              ? "READY"
              : rest.running
                ? "RESTING"
                : "PAUSED"}
          </span>
        </p>

        <div
          className="final-progress"
          role="progressbar"
          aria-label="Rest time remaining"
          aria-valuemin={0}
          aria-valuemax={rest.total}
          aria-valuenow={rest.remaining}
        >
          <i style={{ width: `${restProgress}%` }} />
        </div>

        {rest.remaining === 0 ? (
          <button
            type="button"
            className="final-primary success"
            onClick={() => onNavigate("final-active")}
          >
            <ForwardIcon />
            Start set {currentSetNumber}
          </button>
        ) : (
          <div className="final-action-row">
            <button
              type="button"
              className="final-icon-button"
              aria-label={
                rest.running ? "Pause rest timer" : "Resume rest timer"
              }
              onClick={() =>
                setRest((current) => ({
                  ...current,
                  running: !current.running,
                }))
              }
            >
              {rest.running ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className={`final-secondary ${skipArmed ? "armed" : ""}`}
              onClick={() => {
                if (!skipArmed) {
                  setSkipArmed(true);
                  setAnnouncement("Tap again to skip the remaining rest.");
                  return;
                }
                setRest((current) => ({
                  ...current,
                  remaining: 0,
                  running: false,
                }));
                setSkipArmed(false);
                setAnnouncement("Rest skipped.");
                onNavigate("final-active");
              }}
            >
              {skipArmed ? "Skip rest?" : "Skip rest"}
            </button>
          </div>
        )}

        <div className="final-rest-adjust">
          <button
            type="button"
            aria-label="Remove 15 seconds of rest"
            onClick={() =>
              setRest((current) => ({
                ...current,
                remaining: Math.max(0, current.remaining - REST_STEP),
              }))
            }
          >
            −15s
          </button>
          <button
            type="button"
            className="add"
            aria-label="Add 15 seconds of rest"
            onClick={() =>
              setRest((current) => ({
                ...current,
                remaining: Math.min(600, current.remaining + REST_STEP),
                total: Math.max(current.total, current.remaining + REST_STEP),
                running: true,
              }))
            }
          >
            +15s
          </button>
        </div>

        <div className="final-next-card">
          <span>NEXT SET</span>
          <strong>{activePlan.name}</strong>
          <p>
            Target {activeProgress.reps} × {activeProgress.weight} kg
            <i>
              Last time {activePlan.lastReps} × {activePlan.lastWeight} kg
            </i>
          </p>
        </div>
      </div>
    </>
  );

  const renderHeart = () => (
    <>
      <div className="final-context">
        <span className="final-context-label">HEART RATE</span>
        <span className="final-live-badge">LIVE</span>
      </div>

      <div className="final-scroll final-heart-content">
        <div className="final-heart-measure">
          <span
            className="final-heart-pulse"
            style={{
              animationDuration: `${(60 / Math.max(heartRate, 40)).toFixed(2)}s`,
            }}
          >
            <i
              style={{
                animationDuration: `${(60 / Math.max(heartRate, 40)).toFixed(2)}s`,
              }}
            />
            <HeartIcon />
          </span>
          <strong>{heartRate}</strong>
          <span className="final-heart-unit">BPM · {heartZone(heartRate)}</span>
        </div>

        <div className={`final-recovery ${recovered ? "ready" : ""}`}>
          <span>
            {recovered ? "RECOVERED" : "RECOVERING"}
            <i>−{recoveryDrop} since last set</i>
          </span>
          <div
            className="final-progress"
            role="progressbar"
            aria-label="Recovery toward the ready threshold"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              Math.max(
                0,
                Math.min(
                  100,
                  ((heartRateAtLastSet - heartRate) /
                    Math.max(1, heartRateAtLastSet - RECOVERED_BPM)) *
                    100
                )
              )
            )}
          >
            <i
              className={recovered ? "success" : ""}
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    ((heartRateAtLastSet - heartRate) /
                      Math.max(1, heartRateAtLastSet - RECOVERED_BPM)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
          <small>Ready for the next set under {RECOVERED_BPM} bpm</small>
        </div>

        <button
          type="button"
          className={`final-primary ${recovered ? "success" : ""}`}
          onClick={() => onNavigate("final-active")}
        >
          <ForwardIcon />
          Start set {currentSetNumber}
        </button>
      </div>
    </>
  );

  const renderExerciseDone = () => {
    const sets = activeProgress.sets;
    const records = sets.filter((set) => set.isPersonalRecord).length;
    return (
      <>
        <div className="final-context">
          <span className="final-context-label">EXERCISE COMPLETE</span>
          <HeartChip bpm={heartRate} onOpen={openHeart} />
        </div>

        <div className="final-scroll">
          <p className="final-done-mark">
            <CheckIcon />
          </p>
          <h2 className="final-exercise-name">{activePlan.name}</h2>

          <div className="final-stats">
            <span>
              <small>SETS</small>
              <strong>
                {sets.length}/{activePlan.targetSets}
              </strong>
            </span>
            <span>
              <small>VOLUME</small>
              <strong>{formatVolume(volumeOf(sets))}</strong>
            </span>
            <span>
              <small>TIME</small>
              <strong>{formatTime(activeProgress.seconds)}</strong>
            </span>
          </div>

          {records > 0 ? (
            <p className="final-record-banner">
              <TrophyIcon />
              {records} personal record{records > 1 ? "s" : ""} this exercise
            </p>
          ) : null}

          {nextPlan ? (
            <button
              type="button"
              className="final-primary success"
              onClick={() => selectExercise(nextPlan.id)}
            >
              <ForwardIcon />
              Start {nextPlan.name}
            </button>
          ) : (
            <button
              type="button"
              className="final-primary success"
              onClick={endWorkout}
            >
              <CheckIcon />
              Finish workout
            </button>
          )}

          <button
            type="button"
            className="final-secondary"
            onClick={() => onNavigate("final-list")}
          >
            Exercise list
          </button>
        </div>
      </>
    );
  };

  const renderWorkoutDone = () => (
    <div className="final-scroll">
      <p className="final-done-mark large">
        <CheckIcon />
      </p>
      <h2 className="final-exercise-name">Push day complete</h2>

      <div className="final-stats">
        <span>
          <small>TIME</small>
          <strong>{formatTime(elapsed)}</strong>
        </span>
        <span>
          <small>SETS</small>
          <strong>{totalSets}</strong>
        </span>
        <span>
          <small>VOLUME</small>
          <strong>{formatVolume(totalVolume)}</strong>
        </span>
      </div>

      {totalRecords > 0 ? (
        <p className="final-record-banner">
          <TrophyIcon />
          {totalRecords} personal record{totalRecords > 1 ? "s" : ""}
        </p>
      ) : null}

      <ul className="final-summary-list" aria-label="Exercises completed">
        {EXERCISE_PLANS.map((plan) => {
          const sets = progress[plan.id].sets;
          return (
            <li key={plan.id} className={sets.length ? "" : "skipped"}>
              <strong>{plan.name}</strong>
              <span>
                {sets.length}/{plan.targetSets}
              </span>
            </li>
          );
        })}
      </ul>

      <button type="button" className="final-primary" onClick={resetSession}>
        Start a new session
      </button>
    </div>
  );

  const content = (() => {
    switch (screenId) {
      case "final-active":
        return renderActive();
      case "final-rest":
        return renderRest();
      case "final-heart":
        return renderHeart();
      case "final-exercise-done":
        return renderExerciseDone();
      case "final-workout-done":
        return renderWorkoutDone();
      default:
        return renderList();
    }
  })();

  return (
    <WatchShell
      onCrownDelta={crownHandler}
      crownLabel={crownLabel}
      crownActive={screenId === "final-active" && metric === "weight"}
    >
      <div className="watch-screen final-screen">
        <div className="final-status-bar">
          {leading}
          <span className="final-clock">10:09</span>
        </div>

        <div className="final-view" key={screenId}>
          {content}
        </div>

        {isPaused && !pauseSheetOpen ? (
          <button
            type="button"
            className="final-paused-banner"
            onClick={() => setPauseSheetOpen(true)}
          >
            <PlayIcon />
            Workout paused
          </button>
        ) : null}

        {toast ? (
          <div
            key={toast.key}
            className={`final-toast ${toast.tone}`}
            role="status"
          >
            <span>
              {toast.tone === "record" ? <TrophyIcon /> : <CheckIcon />}
              {toast.message}
            </span>
            {toast.undoable ? (
              <button type="button" onClick={undoLastSet}>
                <UndoIcon />
                Undo
              </button>
            ) : null}
          </div>
        ) : null}

        {pauseSheetOpen ? (
          <div
            className="final-sheet"
            role="dialog"
            aria-label="Workout paused"
          >
            <strong>Workout {isPaused ? "paused" : "running"}</strong>
            <p>
              {formatTime(elapsed)} · {totalSets} sets ·{" "}
              {formatVolume(totalVolume)}
            </p>
            <button
              type="button"
              className="final-primary"
              onClick={() => {
                setIsPaused((current) => !current);
                setPauseSheetOpen(false);
              }}
            >
              {isPaused ? <PlayIcon /> : <PauseIcon />}
              {isPaused ? "Resume workout" : "Pause workout"}
            </button>
            <button
              type="button"
              className="final-secondary"
              onClick={() => setPauseSheetOpen(false)}
            >
              Keep training
            </button>
            <button type="button" className="final-danger" onClick={endWorkout}>
              End workout
            </button>
          </div>
        ) : null}

        <p className="final-live-region" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </WatchShell>
  );
}
