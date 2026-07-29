"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface LayoutOption {
  id:
    | "pulse"
    | "console"
    | "crown"
    | "tide"
    | "flick"
    | "orbit"
    | "signal"
    | "drum"
    | "rail"
    | "plates"
    | "gate"
    | "verdict";
  number: string;
  name: string;
  summary: string;
  principle: string;
  hint: string;
}

interface FinalScreenOption {
  id: "final-list" | "final-active" | "final-rest" | "final-heart";
  number: string;
  name: string;
  summary: string;
  canvasNote: string;
}

type ScreenId = LayoutOption["id"] | FinalScreenOption["id"];

interface TrainingExercise {
  id: "bench-press" | "shoulder-press" | "cable-fly" | "triceps-pressdown";
  name: string;
  prescription: string;
}

const TRAINING_EXERCISES: TrainingExercise[] = [
  {
    id: "bench-press",
    name: "Bench Press",
    prescription: "4 sets · 42.5 kg",
  },
  {
    id: "shoulder-press",
    name: "Shoulder Press",
    prescription: "4 sets · 30 kg",
  },
  {
    id: "cable-fly",
    name: "Cable Fly",
    prescription: "4 sets · 15 kg",
  },
  {
    id: "triceps-pressdown",
    name: "Triceps Pressdown",
    prescription: "4 sets · 20 kg",
  },
];

const FINAL_SCREENS: FinalScreenOption[] = [
  {
    id: "final-list",
    number: "A",
    name: "Exercise list",
    summary: "Every exercise in the current training session.",
    canvasNote: "Choose an exercise without leaving the current workout.",
  },
  {
    id: "final-active",
    number: "B",
    name: "Active workout",
    summary: "The primary screen used while completing a set.",
    canvasNote: "Rep-first logging with a quick switch to load adjustment.",
  },
  {
    id: "final-rest",
    number: "C",
    name: "Rest timer",
    summary: "The recovery state between completed sets.",
    canvasNote: "A recovery-first countdown with the next set always visible.",
  },
  {
    id: "final-heart",
    number: "D",
    name: "Heart rate",
    summary: "A focused view for measuring training intensity.",
    canvasNote: "A distraction-free live pulse measurement.",
  },
];

const LAYOUTS: LayoutOption[] = [
  {
    id: "pulse",
    number: "01",
    name: "Set Pulse",
    summary: "One bold number. Fast taps. Rest stays in sight.",
    principle: "Best for low-friction logging",
    hint: "Adjust the numbers and log a set. The timer starts automatically, matching the real workout flow.",
  },
  {
    id: "console",
    number: "02",
    name: "Split Console",
    summary: "Weight and reps share the stage with a live rest dial.",
    principle: "Best for precise adjustments",
    hint: "Nudge weight and reps independently, then tap the green check to commit the set.",
  },
  {
    id: "crown",
    number: "03",
    name: "Crown Forge (Grok 4.5)",
    summary: "Digital Crown owns precision. Tap modes, turn the dial.",
    principle: "Best for one-handed crown control",
    hint: "Tap the crown or mode chip to switch Weight ↔ Reps, then drag the dial or use ±. Log with the forge button.",
  },
  {
    id: "tide",
    number: "04",
    name: "Tide Rest (Grok 4.5)",
    summary: "Work is a stamp. Rest becomes the whole screen.",
    principle: "Best for recovery-first focus",
    hint: "Log a set to enter the tide. Tap the wave to pause or resume. Breathe with the fill.",
  },
  {
    id: "flick",
    number: "05",
    name: "Flick Ledger (Grok 4.5)",
    summary: "No steppers. Swipe to count, flick up to log.",
    principle: "Best for glove-free gesture logging",
    hint: "Swipe left/right for reps, up to log, down for rest. Double-tap the number to edit weight.",
  },
  {
    id: "orbit",
    number: "06",
    name: "Set Orbit (Grok 4.5)",
    summary: "Sets live in space. The current node is gravity.",
    principle: "Best for spatial session progress",
    hint: "Tap orbit nodes to jump sets. Center shows load × reps. Outer ring is rest. Tap center to log.",
  },
  {
    id: "signal",
    number: "07",
    name: "Lone Signal (Grok 4.5)",
    summary: "One adaptive number. Context decides what matters.",
    principle: "Best for glanceable single focus",
    hint: "During work: tap ± for reps, hold to nudge weight. During rest: only the countdown. Tap bottom to log or skip.",
  },
  {
    id: "drum",
    number: "08",
    name: "Rep Drum (Fable 5)",
    summary: "The whole screen is one rep. Hit it like a drum.",
    principle: "Best for eyes-free rep counting",
    hint: "Tap anywhere on the drum once per rep — no aiming needed mid-set. Press and hold the drum to log. During rest the drum sleeps into a countdown.",
  },
  {
    id: "rail",
    number: "09",
    name: "Session Rail (Fable 5)",
    summary: "The session is a timeline. Done fades up, next waits below.",
    principle: "Best for seeing the whole session",
    hint: "The active row expands with inline controls. Tap other rows (or the crown) to peek at them. Rest fills the left rail — tap it to pause.",
  },
  {
    id: "plates",
    number: "10",
    name: "Plate Stack (Fable 5)",
    summary: "Load a real bar, not a number. Reps are chalk marks.",
    principle: "Best for thinking in plates",
    hint: "Tap a plate chip to slide it onto the bar, tap a loaded plate to strip it. Chalk tallies count reps. Slap CHALK SET to log.",
  },
  {
    id: "gate",
    number: "11",
    name: "Heart Gate (Fable 5)",
    summary: "Your pulse opens the next set — not a timer.",
    principle: "Best for honest recovery",
    hint: "After logging, watch your heart rate settle toward the gate line. The BEGIN button unlocks when you've actually recovered. Tap the ring to override.",
  },
  {
    id: "verdict",
    number: "12",
    name: "Verdict (Fable 5)",
    summary: "No numbers to type. Judge the set: short, hit, or beat.",
    principle: "Best for zero-entry logging",
    hint: "The plan card shows the target. After the set, hit one verdict — SHORT, HIT, or BEAT — and it logs instantly with the right adjustment.",
  },
];

const REST_DURATION = 90;
const TOTAL_SETS = 4;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.6 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19.5 6.5" />
    </svg>
  );
}

function WatchShell({
  children,
  crownActive = false,
  onCrownClick,
}: {
  children: React.ReactNode;
  crownActive?: boolean;
  onCrownClick?: () => void;
}) {
  return (
    <div className="watch-frame">
      {onCrownClick ? (
        <button
          type="button"
          className={`watch-crown interactive ${crownActive ? "active" : ""}`}
          aria-label="Turn Digital Crown"
          onClick={onCrownClick}
        />
      ) : (
        <div className="watch-crown" />
      )}
      <div className="watch-button" />
      <div className="watch-glass">{children}</div>
    </div>
  );
}

function WatchStatus() {
  return (
    <div className="watch-status">
      <span>10:09</span>
      <span className="status-dot" />
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  );
}

interface FinalWatchProps extends WatchProps {
  onNavigate: (screen: FinalScreenOption["id"]) => void;
  onHeartBack: () => void;
  activeExercise: TrainingExercise;
  onSelectExercise: (exerciseId: TrainingExercise["id"]) => void;
}

function FinalExerciseListWatch({
  completedSets,
  activeExercise,
  onSelectExercise,
  onNavigate,
}: FinalWatchProps) {
  const selectExercise = (exerciseId: TrainingExercise["id"]) => {
    onSelectExercise(exerciseId);
    onNavigate("final-active");
  };

  return (
    <WatchShell>
      <div className="watch-screen final-flow-screen final-workout-list-screen">
        <div className="final-list-status">
          <span>10:09</span>
          <button
            type="button"
            className="final-heart-link"
            aria-label="Open heart rate"
            onClick={() => onNavigate("final-heart")}
          >
            <HeartIcon />
            142
          </button>
        </div>

        <header className="final-list-heading">
          <span>CURRENT TRAINING</span>
          <h2>Push day</h2>
        </header>

        <div className="final-exercise-list">
          {TRAINING_EXERCISES.map((exercise, index) => {
            const isActive = exercise.id === activeExercise.id;

            return (
              <button
                type="button"
                key={exercise.id}
                className={`final-exercise-list-item ${
                  isActive ? "active" : ""
                }`}
                onClick={() => selectExercise(exercise.id)}
              >
                <span className="final-exercise-order">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="final-exercise-copy">
                  <strong>{exercise.name}</strong>
                  <small>{exercise.prescription}</small>
                </span>
                <span className="final-exercise-state">
                  {isActive
                    ? `${Math.min(completedSets + 1, TOTAL_SETS)}/${TOTAL_SETS}`
                    : "NEXT"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </WatchShell>
  );
}

function FinalActiveWorkoutWatch({
  reps,
  weight,
  completedSets,
  onRepsChange,
  onWeightChange,
  onComplete,
  onNavigate,
  activeExercise,
}: FinalWatchProps) {
  const [pickerMode, setPickerMode] = useState<"reps" | "weight">("reps");
  const isReps = pickerMode === "reps";
  const displayValue = isReps ? reps : weight;
  const decrement = () => {
    if (isReps) {
      onRepsChange(Math.max(0, reps - 1));
    } else {
      onWeightChange(Math.max(0, Number((weight - 2.5).toFixed(1))));
    }
  };
  const increment = () => {
    if (isReps) {
      onRepsChange(Math.min(99, reps + 1));
    } else {
      onWeightChange(Math.min(500, Number((weight + 2.5).toFixed(1))));
    }
  };

  const saveSet = () => {
    onComplete();
    onNavigate("final-rest");
  };

  return (
    <WatchShell>
      <div className="watch-screen final-flow-screen final-active-screen">
        <div className="final-screen-nav">
          <button
            type="button"
            className="final-back-button"
            aria-label="Back to workout list"
            onClick={() => onNavigate("final-list")}
          >
            <BackIcon />
          </button>
          <button
            type="button"
            className="final-heart-link"
            aria-label="Open heart rate"
            onClick={() => onNavigate("final-heart")}
          >
            <HeartIcon />
            142
          </button>
        </div>

        <header className="final-exercise-row">
          <h2>{activeExercise.name}</h2>
          <strong>
            {Math.min(completedSets + 1, TOTAL_SETS)}/{TOTAL_SETS}
          </strong>
        </header>

        <div className="final-picker">
          <button
            type="button"
            aria-label={`Decrease ${pickerMode}`}
            onClick={decrement}
          >
            −
          </button>
          <div className="final-picker-value">
            <strong>{displayValue}</strong>
            <span>{isReps ? "REPS" : "KG"}</span>
          </div>
          <button
            type="button"
            className="increase"
            aria-label={`Increase ${pickerMode}`}
            onClick={increment}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="final-metric-switch"
          onClick={() => setPickerMode(isReps ? "weight" : "reps")}
        >
          <span>{isReps ? `${weight} kg` : `${reps} reps`}</span>
          <small>Adjust</small>
        </button>

        <button type="button" className="final-save-set" onClick={saveSet}>
          <CheckIcon />
          Save set
        </button>
      </div>
    </WatchShell>
  );
}

function FinalRestTimerWatch({
  rest,
  isResting,
  reps,
  weight,
  completedSets,
  onRestChange,
  onToggleTimer,
  onNavigate,
  activeExercise,
}: FinalWatchProps) {
  const progress = Math.max(0, Math.min(100, (rest / REST_DURATION) * 100));

  const skipRest = () => {
    onRestChange(0);
    if (isResting) onToggleTimer();
    onNavigate("final-active");
  };

  return (
    <WatchShell>
      <div className="watch-screen final-flow-screen final-rest-screen">
        <div className="final-rest-nav">
          <button type="button" onClick={skipRest}>
            Skip
          </button>
          <button
            type="button"
            className="final-heart-link"
            aria-label="Open heart rate"
            onClick={() => onNavigate("final-heart")}
          >
            <HeartIcon />
            142
          </button>
        </div>

        <button
          type="button"
          className="final-rest-countdown"
          onClick={onToggleTimer}
          aria-label={isResting ? "Pause rest timer" : "Resume rest timer"}
        >
          <strong>{formatTime(rest)}</strong>
          <span>{isResting ? "RESTING" : "PAUSED"}</span>
        </button>

        <div
          className="final-rest-progress"
          role="progressbar"
          aria-label="Rest time remaining"
          aria-valuemin={0}
          aria-valuemax={REST_DURATION}
          aria-valuenow={rest}
        >
          <i style={{ width: `${progress}%` }} />
        </div>

        <div className="final-next-set">
          <span>NEXT SET</span>
          <strong>
            {activeExercise.name}
            <small>
              Set {Math.min(completedSets + 1, TOTAL_SETS)}/{TOTAL_SETS}
            </small>
          </strong>
          <p>
            {weight} kg <i>×</i> {reps}
          </p>
        </div>

        <div className="final-rest-adjust">
          <button
            type="button"
            onClick={() => onRestChange(Math.max(0, rest - 15))}
          >
            −15s
          </button>
          <button
            type="button"
            onClick={() => onRestChange(Math.min(300, rest + 15))}
          >
            +15s
          </button>
        </div>
      </div>
    </WatchShell>
  );
}

function FinalHeartRateWatch({ onHeartBack }: FinalWatchProps) {
  return (
    <WatchShell>
      <div className="watch-screen final-flow-screen final-heart-screen">
        <div className="final-heart-nav">
          <button
            type="button"
            className="final-back-button"
            aria-label="Back"
            onClick={onHeartBack}
          >
            <BackIcon />
          </button>
          <span>LIVE</span>
        </div>

        <div className="final-heart-measure">
          <span className="final-heart-pulse">
            <i />
            <HeartIcon />
          </span>
          <strong>142</strong>
          <span>BPM</span>
        </div>
      </div>
    </WatchShell>
  );
}

interface WatchProps {
  reps: number;
  weight: number;
  rest: number;
  isResting: boolean;
  completedSets: number;
  onRepsChange: (next: number) => void;
  onWeightChange: (next: number) => void;
  onComplete: () => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onRestChange: (next: number) => void;
}

function SetPulseWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const timerProgress = (rest / REST_DURATION) * 100;

  return (
    <WatchShell>
      <div className="watch-screen pulse-screen">
        <WatchStatus />
        <header className="exercise-heading">
          <div>
            <span className="eyebrow">
              SET {Math.min(completedSets + 1, TOTAL_SETS)} OF {TOTAL_SETS}
            </span>
            <h2>Incline Press</h2>
          </div>
          <span className="heart-rate">
            <HeartIcon />
            142
          </span>
        </header>

        <div className="rep-stage">
          <button
            className="rep-touch minus"
            aria-label="Decrease reps"
            onClick={() => onRepsChange(Math.max(0, reps - 1))}
          >
            −
          </button>
          <div className="rep-readout">
            <span className="rep-number">{reps}</span>
            <span className="rep-label">REPS</span>
          </div>
          <button
            className="rep-touch plus"
            aria-label="Increase reps"
            onClick={() => onRepsChange(Math.min(99, reps + 1))}
          >
            +
          </button>
        </div>

        <div className="load-strip">
          <span>LOAD</span>
          <strong>{weight} kg</strong>
          <span className="previous">PREV 10 × 42.5</span>
        </div>

        <div className="pulse-actions">
          <button
            className="rest-pill"
            onClick={onToggleTimer}
            aria-label={isResting ? "Pause rest timer" : "Start rest timer"}
          >
            <span
              className="mini-ring"
              style={{
                background: `conic-gradient(var(--blue) ${timerProgress}%, var(--border) 0)`,
              }}
            >
              <i />
            </span>
            <span>
              <small>{isResting ? "RESTING" : "REST"}</small>
              <strong>{formatTime(rest)}</strong>
            </span>
          </button>
          <button className="complete-button" onClick={onComplete}>
            <CheckIcon />
            Log set
          </button>
        </div>
      </div>
    </WatchShell>
  );
}

function SplitConsoleWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onWeightChange,
  onComplete,
  onToggleTimer,
  onResetTimer,
}: WatchProps) {
  const timerProgress = (rest / REST_DURATION) * 100;

  return (
    <WatchShell>
      <div className="watch-screen console-screen">
        <WatchStatus />
        <header className="console-heading">
          <div>
            <span className="eyebrow">PUSH · {completedSets + 7}:32</span>
            <h2>Incline Press</h2>
          </div>
          <span className="set-orb">
            {Math.min(completedSets + 1, TOTAL_SETS)}/{TOTAL_SETS}
          </span>
        </header>

        <div className="console-grid">
          <div className="metric-panel">
            <span>WEIGHT</span>
            <strong>{weight}</strong>
            <small>KG</small>
            <div className="stepper">
              <button
                aria-label="Decrease weight"
                onClick={() =>
                  onWeightChange(Math.max(0, Number((weight - 2.5).toFixed(1))))
                }
              >
                −
              </button>
              <button
                aria-label="Increase weight"
                onClick={() =>
                  onWeightChange(
                    Math.min(500, Number((weight + 2.5).toFixed(1)))
                  )
                }
              >
                +
              </button>
            </div>
          </div>
          <div className="metric-panel rep-panel">
            <span>REPS</span>
            <strong>{reps}</strong>
            <small>COUNT</small>
            <div className="stepper">
              <button
                aria-label="Decrease reps"
                onClick={() => onRepsChange(Math.max(0, reps - 1))}
              >
                −
              </button>
              <button
                aria-label="Increase reps"
                onClick={() => onRepsChange(Math.min(99, reps + 1))}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="console-footer">
          <button
            className="timer-dial"
            onClick={onToggleTimer}
            onDoubleClick={onResetTimer}
            aria-label={isResting ? "Pause rest timer" : "Start rest timer"}
            style={{
              background: `conic-gradient(var(--blue) ${timerProgress}%, var(--border) 0)`,
            }}
          >
            <span>
              <small>{isResting ? "PAUSE" : "REST"}</small>
              <strong>{formatTime(rest)}</strong>
            </span>
          </button>
          <div className="console-meta">
            <span>
              <HeartIcon /> 142
            </span>
            <small>PREVIOUS</small>
            <strong>42.5 × 10</strong>
          </div>
          <button
            className="console-complete"
            onClick={onComplete}
            aria-label="Log set"
          >
            <CheckIcon />
          </button>
        </div>
      </div>
    </WatchShell>
  );
}

type CrownMode = "reps" | "weight";

function CrownForgeWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onWeightChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const [mode, setMode] = useState<CrownMode>("reps");
  const [tickFlash, setTickFlash] = useState(false);
  const dragRef = useRef<{ y: number; value: number } | null>(null);
  const timerProgress = (rest / REST_DURATION) * 100;
  const value = mode === "reps" ? reps : weight;
  const dialRotation =
    mode === "reps" ? (reps / 20) * 270 - 135 : (weight / 100) * 270 - 135;

  const nudge = useCallback(
    (direction: 1 | -1) => {
      setTickFlash(true);
      window.setTimeout(() => setTickFlash(false), 120);
      if (mode === "reps") {
        onRepsChange(Math.min(99, Math.max(0, reps + direction)));
      } else {
        onWeightChange(
          Math.min(
            500,
            Math.max(0, Number((weight + direction * 2.5).toFixed(1)))
          )
        );
      }
    },
    [mode, onRepsChange, onWeightChange, reps, weight]
  );

  const toggleMode = useCallback(() => {
    setMode((current) => (current === "reps" ? "weight" : "reps"));
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { y: event.clientY, value };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.y - event.clientY;
    if (Math.abs(delta) < 14) return;
    const steps = Math.trunc(delta / 14);
    dragRef.current = {
      y: event.clientY,
      value: dragRef.current.value,
    };
    if (steps > 0) nudge(1);
    if (steps < 0) nudge(-1);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <WatchShell crownActive={mode === "weight"} onCrownClick={toggleMode}>
      <div className={`watch-screen crown-screen ${tickFlash ? "ticked" : ""}`}>
        <WatchStatus />
        <header className="crown-heading">
          <span className="eyebrow">
            SET {Math.min(completedSets + 1, TOTAL_SETS)}
          </span>
          <button
            type="button"
            className={`crown-mode ${mode}`}
            onClick={toggleMode}
            aria-label={`Editing ${mode}. Switch mode.`}
          >
            {mode === "reps" ? "REPS" : "KG"}
          </button>
        </header>

        <div
          className="crown-dial"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={mode === "reps" ? 99 : 500}
          aria-valuenow={value}
          aria-label={mode === "reps" ? "Reps dial" : "Weight dial"}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowRight") {
              event.preventDefault();
              nudge(1);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
              event.preventDefault();
              nudge(-1);
            }
          }}
        >
          <div
            className="crown-ring"
            style={{
              background: `conic-gradient(from 180deg, var(--border) 0deg, var(--blue) ${Math.max(8, ((mode === "reps" ? reps : weight / 2.5) / 40) * 360)}deg, var(--border) 0deg)`,
            }}
          >
            <div className="crown-face">
              <strong className="crown-value">
                {mode === "reps" ? reps : weight}
              </strong>
              <span>{mode === "reps" ? "COUNT" : "LOAD"}</span>
            </div>
          </div>
          <span
            className="crown-needle"
            style={{ transform: `rotate(${dialRotation}deg)` }}
          />
        </div>

        <div className="crown-meta">
          <span>{mode === "reps" ? `${weight} kg` : `${reps} reps`}</span>
          <button type="button" onClick={onToggleTimer} className="crown-rest">
            <i style={{ width: `${timerProgress}%` }} />
            <span>
              {isResting ? "REST" : "HOLD"} {formatTime(rest)}
            </span>
          </button>
        </div>

        <div className="crown-actions">
          <button type="button" aria-label="Decrease" onClick={() => nudge(-1)}>
            −
          </button>
          <button
            type="button"
            className="crown-forge"
            onClick={onComplete}
            aria-label="Log set"
          >
            <CheckIcon />
            Forge
          </button>
          <button type="button" aria-label="Increase" onClick={() => nudge(1)}>
            +
          </button>
        </div>
      </div>
    </WatchShell>
  );
}

function TideRestWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const fill = ((REST_DURATION - rest) / REST_DURATION) * 100;
  const breathPhase = isResting && rest > 0;

  if (isResting && rest > 0) {
    return (
      <WatchShell>
        <div className="watch-screen tide-screen tide-resting">
          <WatchStatus />
          <div className="tide-copy">
            <span className="eyebrow">RECOVER</span>
            <strong className="tide-clock">{formatTime(rest)}</strong>
            <p>
              Inhale with the tide. Next: set{" "}
              {Math.min(completedSets + 1, TOTAL_SETS)}
            </p>
          </div>
          <button
            type="button"
            className={`tide-ocean ${breathPhase ? "breathing" : ""}`}
            onClick={onToggleTimer}
            aria-label={isResting ? "Pause rest" : "Resume rest"}
          >
            <span className="tide-fill" style={{ height: `${fill}%` }}>
              <span className="tide-foam" />
            </span>
            <span className="tide-label">TAP TO PAUSE</span>
          </button>
          <div className="tide-footer-quiet">
            <span>
              LAST {weight} × {reps}
            </span>
            <span>
              <HeartIcon /> 128
            </span>
          </div>
        </div>
      </WatchShell>
    );
  }

  return (
    <WatchShell>
      <div className="watch-screen tide-screen tide-work">
        <WatchStatus />
        <header className="tide-work-head">
          <span className="eyebrow">
            WORK · SET {Math.min(completedSets + 1, TOTAL_SETS)}
          </span>
          <h2>Incline Press</h2>
        </header>

        <div className="tide-stamp">
          <button
            type="button"
            className="tide-rep-hit"
            aria-label="Decrease reps"
            onClick={() => onRepsChange(Math.max(0, reps - 1))}
          >
            −
          </button>
          <div>
            <strong>{reps}</strong>
            <span>REPS @ {weight} KG</span>
          </div>
          <button
            type="button"
            className="tide-rep-hit"
            aria-label="Increase reps"
            onClick={() => onRepsChange(Math.min(99, reps + 1))}
          >
            +
          </button>
        </div>

        <button type="button" className="tide-log" onClick={onComplete}>
          <span className="tide-log-ring" />
          <strong>STAMP SET</strong>
          <small>Starts recovery tide</small>
        </button>

        {rest === 0 && (
          <button type="button" className="tide-skip" onClick={onToggleTimer}>
            Restart rest
          </button>
        )}
      </div>
    </WatchShell>
  );
}

function FlickLedgerWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onWeightChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const [editingWeight, setEditingWeight] = useState(false);
  const [gestureHint, setGestureHint] = useState("SWIPE TO COUNT");
  const [flash, setFlash] = useState<"left" | "right" | "up" | "down" | null>(
    null
  );
  const origin = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);

  const flashDir = (dir: "left" | "right" | "up" | "down") => {
    setFlash(dir);
    window.setTimeout(() => setFlash(null), 220);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    origin.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    origin.current = null;

    if (absX < 28 && absY < 28) {
      const now = Date.now();
      if (now - lastTap.current < 320) {
        setEditingWeight((current) => !current);
        setGestureHint(editingWeight ? "SWIPE TO COUNT" : "SWIPE FOR LOAD");
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
      return;
    }

    if (absY > absX && dy < -40) {
      flashDir("up");
      setGestureHint("SET LOGGED");
      onComplete();
      return;
    }

    if (absY > absX && dy > 40) {
      flashDir("down");
      setGestureHint(isResting ? "REST PAUSED" : "REST RUNNING");
      onToggleTimer();
      return;
    }

    if (absX > absY) {
      if (editingWeight) {
        const next =
          dx > 0
            ? Math.min(500, Number((weight + 2.5).toFixed(1)))
            : Math.max(0, Number((weight - 2.5).toFixed(1)));
        onWeightChange(next);
        setGestureHint(`${next} KG`);
      } else {
        const next = dx > 0 ? Math.min(99, reps + 1) : Math.max(0, reps - 1);
        onRepsChange(next);
        setGestureHint(`${next} REPS`);
      }
      flashDir(dx > 0 ? "right" : "left");
    }
  };

  return (
    <WatchShell>
      <div
        className={`watch-screen flick-screen ${flash ? `flash-${flash}` : ""}`}
      >
        <WatchStatus />
        <div className="flick-top">
          <span className="eyebrow">
            {Math.min(completedSets + 1, TOTAL_SETS)}/{TOTAL_SETS} · INCLINE
          </span>
          <span className={`flick-rest-dot ${isResting ? "on" : ""}`}>
            {formatTime(rest)}
          </span>
        </div>

        <div
          className="flick-stage"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            origin.current = null;
          }}
          role="application"
          aria-label="Gesture ledger. Swipe horizontally to adjust, up to log, down for rest. Double tap to switch weight."
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              onRepsChange(Math.min(99, reps + 1));
            }
            if (event.key === "ArrowLeft") {
              onRepsChange(Math.max(0, reps - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              onComplete();
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onToggleTimer();
            }
          }}
        >
          <span className="flick-ghost flick-left">−</span>
          <span className="flick-ghost flick-right">+</span>
          <span className="flick-ghost flick-up">LOG</span>
          <span className="flick-ghost flick-down">REST</span>

          <strong className="flick-number">
            {editingWeight ? weight : reps}
          </strong>
          <span className="flick-unit">
            {editingWeight ? "KG · DOUBLE TAP REPS" : "REPS · DOUBLE TAP KG"}
          </span>
          <span className="flick-hint">{gestureHint}</span>
        </div>

        <div className="flick-rail">
          <span>{editingWeight ? `${reps} reps` : `${weight} kg`}</span>
          <span>↑ LOG · ↓ REST · ↔ ADJUST</span>
        </div>
      </div>
    </WatchShell>
  );
}

function SetOrbitWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onWeightChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const [focusSet, setFocusSet] = useState(
    Math.min(completedSets + 1, TOTAL_SETS)
  );
  const timerProgress = (rest / REST_DURATION) * 100;
  const nodes = [1, 2, 3, 4];

  useEffect(() => {
    setFocusSet(Math.min(completedSets + 1, TOTAL_SETS));
  }, [completedSets]);

  return (
    <WatchShell
      onCrownClick={() => {
        setFocusSet((current) => (current % TOTAL_SETS) + 1);
      }}
    >
      <div className="watch-screen orbit-screen">
        <WatchStatus />
        <div className="orbit-label">
          <span className="eyebrow">SESSION MAP</span>
          <h2>Incline Press</h2>
        </div>

        <div
          className="orbit-field"
          style={{
            background: `conic-gradient(var(--blue) ${timerProgress}%, rgba(42,45,48,0.9) 0)`,
          }}
        >
          <div className="orbit-inner">
            {nodes.map((node, index) => {
              const angle = -90 + index * 90;
              const done = node <= completedSets;
              const current = node === focusSet;
              return (
                <button
                  key={node}
                  type="button"
                  className={`orbit-node ${done ? "done" : ""} ${current ? "current" : ""}`}
                  style={{
                    transform: `rotate(${angle}deg) translate(78px) rotate(${-angle}deg)`,
                  }}
                  onClick={() => setFocusSet(node)}
                  aria-label={`Set ${node}${done ? ", completed" : ""}`}
                  aria-current={current ? "true" : undefined}
                >
                  {done ? <CheckIcon /> : node}
                </button>
              );
            })}

            <button
              type="button"
              className="orbit-core"
              onClick={onComplete}
              aria-label="Log current set"
            >
              <strong>
                {weight}
                <small>×</small>
                {reps}
              </strong>
              <span>LOG SET {focusSet}</span>
            </button>
          </div>
        </div>

        <div className="orbit-controls">
          <button
            type="button"
            aria-label="Decrease weight"
            onClick={() =>
              onWeightChange(Math.max(0, Number((weight - 2.5).toFixed(1))))
            }
          >
            −kg
          </button>
          <button
            type="button"
            className={`orbit-rest ${isResting ? "live" : ""}`}
            onClick={onToggleTimer}
            aria-label="Toggle rest"
          >
            {formatTime(rest)}
          </button>
          <button
            type="button"
            aria-label="Decrease reps"
            onClick={() => onRepsChange(Math.max(0, reps - 1))}
          >
            −r
          </button>
          <button
            type="button"
            aria-label="Increase reps"
            onClick={() => onRepsChange(Math.min(99, reps + 1))}
          >
            +r
          </button>
        </div>
      </div>
    </WatchShell>
  );
}

function LoneSignalWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onWeightChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const showRest = isResting && rest > 0;
  const holdTimer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);

  const clearHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  };

  useEffect(() => () => clearHold(), []);

  if (showRest) {
    return (
      <WatchShell>
        <div className="watch-screen signal-screen signal-rest">
          <WatchStatus />
          <span className="signal-kicker">
            UNTIL SET {Math.min(completedSets + 1, TOTAL_SETS)}
          </span>
          <button
            type="button"
            className="signal-hero rest"
            onClick={onToggleTimer}
            aria-label="Pause rest timer"
          >
            {formatTime(rest)}
          </button>
          <span className="signal-sub">TAP TO PAUSE</span>
          <div className="signal-whisper">
            <span>
              {weight} × {reps}
            </span>
            <span>
              <HeartIcon /> 124
            </span>
          </div>
        </div>
      </WatchShell>
    );
  }

  return (
    <WatchShell>
      <div
        className={`watch-screen signal-screen signal-work ${holding ? "holding" : ""}`}
      >
        <WatchStatus />
        <span className="signal-kicker">
          SET {Math.min(completedSets + 1, TOTAL_SETS)} · {weight} KG
        </span>

        <div className="signal-row">
          <button
            type="button"
            className="signal-edge"
            aria-label="Decrease reps"
            onClick={() => onRepsChange(Math.max(0, reps - 1))}
            onPointerDown={() => {
              setHolding(true);
              holdTimer.current = window.setTimeout(() => {
                onWeightChange(Math.max(0, Number((weight - 2.5).toFixed(1))));
                setHolding(false);
              }, 480);
            }}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
          >
            −
          </button>
          <div className="signal-hero-wrap" aria-live="polite">
            <strong className="signal-hero">{reps}</strong>
            <span>REPS</span>
          </div>
          <button
            type="button"
            className="signal-edge plus"
            aria-label="Increase reps"
            onClick={() => onRepsChange(Math.min(99, reps + 1))}
            onPointerDown={() => {
              setHolding(true);
              holdTimer.current = window.setTimeout(() => {
                onWeightChange(
                  Math.min(500, Number((weight + 2.5).toFixed(1)))
                );
                setHolding(false);
              }, 480);
            }}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
          >
            +
          </button>
        </div>

        <p className="signal-hold-hint">
          {holding ? "ADJUSTING LOAD…" : "HOLD ± TO NUDGE LOAD"}
        </p>

        <button type="button" className="signal-commit" onClick={onComplete}>
          LOG
        </button>
      </div>
    </WatchShell>
  );
}

function RepDrumWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const [ripple, setRipple] = useState(0);
  const [arming, setArming] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const holdFired = useRef(false);

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setArming(false);
  }, []);

  useEffect(() => () => clearHold(), [clearHold]);

  const countRep = useCallback(() => {
    onRepsChange(Math.min(99, reps + 1));
    setRipple((r) => r + 1);
  }, [onRepsChange, reps]);

  const startHold = () => {
    holdFired.current = false;
    setArming(true);
    holdTimer.current = window.setTimeout(() => {
      holdFired.current = true;
      setArming(false);
      onComplete();
    }, 650);
  };

  const releaseHold = (shouldCount: boolean) => {
    const fired = holdFired.current;
    clearHold();
    if (!fired && shouldCount) countRep();
  };

  if (isResting && rest > 0) {
    const restProgress = (rest / REST_DURATION) * 100;
    return (
      <WatchShell>
        <div className="watch-screen drum-screen drum-asleep">
          <WatchStatus />
          <span className="drum-kicker">
            DRUM SLEEPS · SET {Math.min(completedSets + 1, TOTAL_SETS)} NEXT
          </span>
          <button
            type="button"
            className="drum-rest-ring"
            onClick={onToggleTimer}
            aria-label="Pause rest countdown"
            style={{
              background: `conic-gradient(var(--blue) ${restProgress}%, var(--border) 0)`,
            }}
          >
            <span>
              <strong>{formatTime(rest)}</strong>
              <small>TAP TO PAUSE</small>
            </span>
          </button>
          <span className="drum-quiet">
            LAST HIT · {weight} KG × {reps}
          </span>
        </div>
      </WatchShell>
    );
  }

  return (
    <WatchShell>
      <div className={`watch-screen drum-screen ${arming ? "arming" : ""}`}>
        <WatchStatus />
        <div className="drum-top">
          <span className="eyebrow">
            SET {Math.min(completedSets + 1, TOTAL_SETS)} · {weight} KG
          </span>
          <button
            type="button"
            className="drum-undo"
            onClick={() => onRepsChange(Math.max(0, reps - 1))}
            aria-label="Undo one rep"
          >
            UNDO
          </button>
        </div>

        <div
          className="drum-pad"
          role="button"
          tabIndex={0}
          aria-label={`${reps} reps counted. Tap to add a rep, press and hold to log the set.`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            startHold();
          }}
          onPointerUp={() => releaseHold(true)}
          onPointerLeave={() => releaseHold(false)}
          onPointerCancel={() => releaseHold(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              countRep();
            }
          }}
        >
          <span key={ripple} className="drum-ripple" aria-hidden="true" />
          <span className="drum-hold-fill" aria-hidden="true" />
          <strong className="drum-count">{reps}</strong>
          <span className="drum-sub">
            {arming ? "KEEP HOLDING TO LOG" : "TAP · EACH REP"}
          </span>
        </div>

        <div className="drum-rail">
          <button type="button" className="drum-log" onClick={onComplete}>
            <CheckIcon />
            Log
          </button>
          <span>HOLD DRUM TO LOG · HAPTIC PER TAP</span>
        </div>
      </div>
    </WatchShell>
  );
}

function SessionRailWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onWeightChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const currentSet = Math.min(completedSets + 1, TOTAL_SETS);
  const [focusSet, setFocusSet] = useState(currentSet);
  const restProgress = ((REST_DURATION - rest) / REST_DURATION) * 100;

  useEffect(() => {
    setFocusSet(Math.min(completedSets + 1, TOTAL_SETS));
  }, [completedSets]);

  return (
    <WatchShell onCrownClick={() => setFocusSet((s) => (s % TOTAL_SETS) + 1)}>
      <div className="watch-screen rail-screen">
        <WatchStatus />
        <div className="rail-body">
          <button
            type="button"
            className={`rail-rest-col ${isResting ? "live" : ""}`}
            onClick={onToggleTimer}
            aria-label={
              isResting
                ? `Resting, ${formatTime(rest)} left. Tap to pause.`
                : "Start rest timer"
            }
          >
            <i style={{ height: `${restProgress}%` }} />
            <span>{formatTime(rest)}</span>
          </button>

          <div className="rail-track" role="list" aria-label="Session timeline">
            <span className="rail-title">INCLINE PRESS</span>
            {Array.from({ length: TOTAL_SETS }, (_, i) => i + 1).map((set) => {
              const done = set <= completedSets;
              const active = set === currentSet && !done;
              const focused = set === focusSet;

              if (active && focused) {
                return (
                  <div key={set} className="rail-row rail-now" role="listitem">
                    <span className="rail-index now">{set}</span>
                    <div className="rail-now-body">
                      <div className="rail-chips">
                        <button
                          type="button"
                          aria-label="Decrease weight"
                          onClick={() =>
                            onWeightChange(
                              Math.max(0, Number((weight - 2.5).toFixed(1)))
                            )
                          }
                        >
                          −
                        </button>
                        <span>
                          {weight}
                          <small>KG</small>
                        </span>
                        <button
                          type="button"
                          aria-label="Increase weight"
                          onClick={() =>
                            onWeightChange(
                              Math.min(500, Number((weight + 2.5).toFixed(1)))
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                      <div className="rail-chips reps">
                        <button
                          type="button"
                          aria-label="Decrease reps"
                          onClick={() => onRepsChange(Math.max(0, reps - 1))}
                        >
                          −
                        </button>
                        <span>
                          {reps}
                          <small>REPS</small>
                        </span>
                        <button
                          type="button"
                          aria-label="Increase reps"
                          onClick={() => onRepsChange(Math.min(99, reps + 1))}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="rail-log"
                        onClick={onComplete}
                      >
                        <CheckIcon /> LOG SET {set}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={set}
                  type="button"
                  role="listitem"
                  className={`rail-row ${done ? "done" : "ghost"} ${focused ? "focused" : ""}`}
                  onClick={() => setFocusSet(set)}
                  aria-label={`Set ${set}${done ? ", completed" : ", upcoming"}`}
                >
                  <span className={`rail-index ${done ? "done" : ""}`}>
                    {done ? <CheckIcon /> : set}
                  </span>
                  <span className="rail-row-text">
                    {done ? `${weight} × ${reps}` : `PLAN ${weight} × 10`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </WatchShell>
  );
}

const PLATE_DENOMS = [20, 15, 10, 5, 2.5, 1.25] as const;
const BAR_WEIGHT = 20;

function platesPerSide(weight: number): number[] {
  let remainder = Math.max(0, (weight - BAR_WEIGHT) / 2);
  const plates: number[] = [];
  for (const denom of PLATE_DENOMS) {
    while (remainder >= denom - 0.001 && plates.length < 8) {
      plates.push(denom);
      remainder -= denom;
    }
  }
  return plates;
}

function PlateStackWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onWeightChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const plates = platesPerSide(weight);
  const restProgress = (rest / REST_DURATION) * 100;
  const tallies = Math.min(reps, 12);

  const addPlate = (denom: number) => {
    onWeightChange(Math.min(500, Number((weight + denom * 2).toFixed(2))));
  };

  const stripPlate = (index: number) => {
    const denom = plates[index];
    onWeightChange(
      Math.max(BAR_WEIGHT, Number((weight - denom * 2).toFixed(2)))
    );
  };

  return (
    <WatchShell>
      <div className="watch-screen plates-screen">
        <WatchStatus />
        <div className="plates-top">
          <span className="eyebrow">
            SET {Math.min(completedSets + 1, TOTAL_SETS)} · BAR {BAR_WEIGHT}
          </span>
          <strong className="plates-total">
            {weight}
            <small>KG</small>
          </strong>
        </div>

        <div
          className="plates-bar"
          aria-label={`Bar loaded to ${weight} kilograms`}
        >
          <span className="plates-sleeve" aria-hidden="true" />
          <span className="plates-collar" aria-hidden="true" />
          {plates.map((denom, index) => (
            <button
              key={`${denom}-${index}`}
              type="button"
              className="plates-plate"
              style={{ height: `${34 + denom * 3.1}px` }}
              onClick={() => stripPlate(index)}
              aria-label={`Strip ${denom} kilogram plate`}
            >
              {denom}
            </button>
          ))}
          {plates.length === 0 && (
            <span className="plates-empty">EMPTY BAR</span>
          )}
        </div>

        <div className="plates-rack" role="group" aria-label="Add plates">
          {[1.25, 2.5, 5, 10, 20].map((denom) => (
            <button
              key={denom}
              type="button"
              onClick={() => addPlate(denom)}
              aria-label={`Add pair of ${denom} kilogram plates`}
            >
              +{denom}
            </button>
          ))}
        </div>

        <div className="plates-chalk">
          <button
            type="button"
            className="plates-tally-hit"
            aria-label="Remove one rep tally"
            onClick={() => onRepsChange(Math.max(0, reps - 1))}
          >
            −
          </button>
          <button
            type="button"
            className="plates-board"
            onClick={() => onRepsChange(Math.min(99, reps + 1))}
            aria-label={`${reps} reps chalked. Tap to add one.`}
          >
            {Array.from({ length: tallies }, (_, i) => (
              <i
                key={i}
                className={`chalk ${(i + 1) % 5 === 0 ? "five" : ""}`}
              />
            ))}
            {reps > 12 && <em>+{reps - 12}</em>}
            {reps === 0 && <em>TAP TO CHALK</em>}
          </button>
        </div>

        <div className="plates-footer">
          <button
            type="button"
            className={`plates-rest ${isResting ? "live" : ""}`}
            onClick={onToggleTimer}
            aria-label="Toggle rest timer"
          >
            <i style={{ width: `${restProgress}%` }} />
            <span>{formatTime(rest)}</span>
          </button>
          <button type="button" className="plates-log" onClick={onComplete}>
            CHALK SET
          </button>
        </div>
      </div>
    </WatchShell>
  );
}

const GATE_HR_THRESHOLD = 112;

function HeartGateWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const recovering = isResting && rest > 0;
  const simulatedHR = recovering ? Math.round(96 + rest * 0.5) : 134;
  const gateOpen = !recovering || simulatedHR <= GATE_HR_THRESHOLD;
  const descent = Math.min(
    100,
    Math.max(0, ((141 - simulatedHR) / (141 - GATE_HR_THRESHOLD)) * 100)
  );

  if (recovering) {
    return (
      <WatchShell>
        <div className={`watch-screen gate-screen ${gateOpen ? "open" : ""}`}>
          <WatchStatus />
          <span className="gate-kicker">
            {gateOpen ? "GATE OPEN" : "SETTLING…"}
          </span>
          <button
            type="button"
            className="gate-ring"
            onClick={onToggleTimer}
            aria-label={`Heart rate ${simulatedHR}. Gate opens at ${GATE_HR_THRESHOLD}. Tap to override.`}
            style={{
              background: `conic-gradient(${gateOpen ? "var(--green)" : "var(--blue)"} ${descent}%, var(--border) 0)`,
            }}
          >
            <span className="gate-face">
              <span className="gate-heart">
                <HeartIcon />
              </span>
              <strong>{simulatedHR}</strong>
              <small>GATE AT {GATE_HR_THRESHOLD}</small>
            </span>
          </button>
          <button
            type="button"
            className={`gate-begin ${gateOpen ? "unlocked" : ""}`}
            disabled={!gateOpen}
            onClick={onToggleTimer}
          >
            {gateOpen
              ? `BEGIN SET ${Math.min(completedSets + 1, TOTAL_SETS)}`
              : "RECOVERING"}
          </button>
          <span className="gate-whisper">
            {weight} KG × {reps} QUEUED · BREATHE LOW
          </span>
        </div>
      </WatchShell>
    );
  }

  return (
    <WatchShell>
      <div className="watch-screen gate-screen gate-work">
        <WatchStatus />
        <span className="gate-kicker live">
          SET {Math.min(completedSets + 1, TOTAL_SETS)} LIVE · <HeartIcon />{" "}
          {simulatedHR}
        </span>
        <div className="gate-work-row">
          <button
            type="button"
            aria-label="Decrease reps"
            onClick={() => onRepsChange(Math.max(0, reps - 1))}
          >
            −
          </button>
          <div>
            <strong>{reps}</strong>
            <span>REPS @ {weight} KG</span>
          </div>
          <button
            type="button"
            aria-label="Increase reps"
            onClick={() => onRepsChange(Math.min(99, reps + 1))}
          >
            +
          </button>
        </div>
        <button type="button" className="gate-end" onClick={onComplete}>
          END SET · OPEN GATE
        </button>
      </div>
    </WatchShell>
  );
}

type VerdictKind = "short" | "hit" | "beat";

function VerdictWatch({
  reps,
  weight,
  rest,
  isResting,
  completedSets,
  onRepsChange,
  onComplete,
  onToggleTimer,
}: WatchProps) {
  const [lastVerdict, setLastVerdict] = useState<VerdictKind | null>(null);
  const restProgress = ((REST_DURATION - rest) / REST_DURATION) * 100;

  const judge = (verdict: VerdictKind) => {
    setLastVerdict(verdict);
    if (verdict === "short") onRepsChange(Math.max(0, reps - 1));
    if (verdict === "beat") onRepsChange(Math.min(99, reps + 1));
    onComplete();
  };

  if (isResting && rest > 0) {
    return (
      <WatchShell>
        <div className="watch-screen verdict-screen verdict-rest">
          <WatchStatus />
          {lastVerdict && (
            <span className={`verdict-stamp ${lastVerdict}`}>
              {lastVerdict === "short"
                ? "SHORT"
                : lastVerdict === "hit"
                  ? "HIT"
                  : "BEAT"}
            </span>
          )}
          <div className="verdict-next-card">
            <span>
              NEXT CONTRACT · SET {Math.min(completedSets + 1, TOTAL_SETS)}
            </span>
            <strong>
              {weight} <em>×</em> {reps}
            </strong>
          </div>
          <button
            type="button"
            className="verdict-rest-bar"
            onClick={onToggleTimer}
            aria-label={`Rest, ${formatTime(rest)} remaining. Tap to pause.`}
          >
            <i style={{ width: `${restProgress}%` }} />
            <span>{formatTime(rest)}</span>
          </button>
        </div>
      </WatchShell>
    );
  }

  return (
    <WatchShell>
      <div className="watch-screen verdict-screen">
        <WatchStatus />
        <div className="verdict-card">
          <span>
            THE CONTRACT · SET {Math.min(completedSets + 1, TOTAL_SETS)}
          </span>
          <strong>
            {weight} <em>×</em> {reps}
          </strong>
          <div className="verdict-tune">
            <button
              type="button"
              aria-label="Lower target reps"
              onClick={() => onRepsChange(Math.max(0, reps - 1))}
            >
              −
            </button>
            <small>TUNE TARGET</small>
            <button
              type="button"
              aria-label="Raise target reps"
              onClick={() => onRepsChange(Math.min(99, reps + 1))}
            >
              +
            </button>
          </div>
        </div>

        <div className="verdict-panel" role="group" aria-label="Judge the set">
          <button
            type="button"
            className="verdict-btn short"
            onClick={() => judge("short")}
          >
            <strong>SHORT</strong>
            <small>−1 REP</small>
          </button>
          <button
            type="button"
            className="verdict-btn hit"
            onClick={() => judge("hit")}
          >
            <strong>HIT</strong>
            <small>AS PLANNED</small>
          </button>
          <button
            type="button"
            className="verdict-btn beat"
            onClick={() => judge("beat")}
          >
            <strong>BEAT</strong>
            <small>+1 REP</small>
          </button>
        </div>
      </div>
    </WatchShell>
  );
}

function renderWatch(id: LayoutOption["id"], props: WatchProps) {
  switch (id) {
    case "pulse":
      return <SetPulseWatch {...props} />;
    case "console":
      return <SplitConsoleWatch {...props} />;
    case "crown":
      return <CrownForgeWatch {...props} />;
    case "tide":
      return <TideRestWatch {...props} />;
    case "flick":
      return <FlickLedgerWatch {...props} />;
    case "orbit":
      return <SetOrbitWatch {...props} />;
    case "signal":
      return <LoneSignalWatch {...props} />;
    case "drum":
      return <RepDrumWatch {...props} />;
    case "rail":
      return <SessionRailWatch {...props} />;
    case "plates":
      return <PlateStackWatch {...props} />;
    case "gate":
      return <HeartGateWatch {...props} />;
    case "verdict":
      return <VerdictWatch {...props} />;
    default:
      return <SetPulseWatch {...props} />;
  }
}

function renderFinalWatch(id: FinalScreenOption["id"], props: FinalWatchProps) {
  switch (id) {
    case "final-list":
      return <FinalExerciseListWatch {...props} />;
    case "final-active":
      return <FinalActiveWorkoutWatch {...props} />;
    case "final-rest":
      return <FinalRestTimerWatch {...props} />;
    case "final-heart":
      return <FinalHeartRateWatch {...props} />;
    default:
      return <FinalExerciseListWatch {...props} />;
  }
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<ScreenId>("final-active");
  const [heartReturnScreen, setHeartReturnScreen] =
    useState<FinalScreenOption["id"]>("final-active");
  const [activeExerciseId, setActiveExerciseId] =
    useState<TrainingExercise["id"]>("bench-press");
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(42.5);
  const [rest, setRest] = useState(67);
  const [isResting, setIsResting] = useState(true);
  const [completedSets, setCompletedSets] = useState(1);
  const [confirmation, setConfirmation] = useState(false);

  useEffect(() => {
    if (!isResting || rest <= 0) return;
    const interval = window.setInterval(() => {
      setRest((current) => {
        if (current <= 1) {
          setIsResting(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isResting, rest]);

  useEffect(() => {
    if (!confirmation) return;
    const timeout = window.setTimeout(() => setConfirmation(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [confirmation]);

  const selectedFinal = useMemo(
    () => FINAL_SCREENS.find((screen) => screen.id === selectedId),
    [selectedId]
  );
  const selectedIdea = useMemo(
    () => LAYOUTS.find((layout) => layout.id === selectedId),
    [selectedId]
  );
  const selected = selectedFinal ?? selectedIdea ?? FINAL_SCREENS[0];
  const isFinalDesign = Boolean(selectedFinal);
  const selectedIndex = isFinalDesign
    ? FINAL_SCREENS.findIndex((screen) => screen.id === selected.id) + 1
    : LAYOUTS.findIndex((layout) => layout.id === selected.id) + 1;
  const selectedGroupLength = isFinalDesign
    ? FINAL_SCREENS.length
    : LAYOUTS.length;
  const activeExercise =
    TRAINING_EXERCISES.find((exercise) => exercise.id === activeExerciseId) ??
    TRAINING_EXERCISES[0];

  const completeSet = useCallback(() => {
    setCompletedSets((current) => Math.min(current + 1, TOTAL_SETS));
    setRest(REST_DURATION);
    setIsResting(true);
    setConfirmation(true);
  }, []);

  const resetTimer = useCallback(() => {
    setRest(REST_DURATION);
    setIsResting(false);
  }, []);

  const navigateFinal = useCallback(
    (screen: FinalScreenOption["id"]) => {
      if (screen === "final-heart" && selectedId !== "final-heart") {
        const currentFinal = FINAL_SCREENS.some(
          (candidate) => candidate.id === selectedId
        );
        setHeartReturnScreen(
          currentFinal
            ? (selectedId as FinalScreenOption["id"])
            : "final-active"
        );
      }
      setSelectedId(screen);
    },
    [selectedId]
  );

  const sharedProps: WatchProps = {
    reps,
    weight,
    rest,
    isResting,
    completedSets,
    onRepsChange: setReps,
    onWeightChange: setWeight,
    onComplete: completeSet,
    onToggleTimer: () => {
      if (rest === 0) setRest(REST_DURATION);
      setIsResting((current) => !current);
    },
    onResetTimer: resetTimer,
    onRestChange: setRest,
  };

  const finalProps: FinalWatchProps = {
    ...sharedProps,
    activeExercise,
    onNavigate: navigateFinal,
    onHeartBack: () => setSelectedId(heartReturnScreen),
    onSelectExercise: (exerciseId) => {
      if (exerciseId !== activeExerciseId) {
        setActiveExerciseId(exerciseId);
        setCompletedSets(0);
      }
    },
  };

  return (
    <main className="prototype-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <aside className="concept-sidebar">
        <a className="brand" href="#top" aria-label="Workout watch concepts">
          <span className="brand-mark">W</span>
          <span>
            <strong>WATCH LAB</strong>
            <small>WORKOUT PROTOTYPES</small>
          </span>
        </a>

        <div className="sidebar-intro">
          <span className="section-kicker">DESIGN WORKSPACE</span>
          <h1>From ideas to the final watch.</h1>
          <p>
            Build the final flow on clean canvases, informed by the concept
            explorations below.
          </p>
        </div>

        <nav className="prototype-nav" aria-label="Apple Watch designs">
          <section className="concept-group final-design-group">
            <div className="concept-group-heading">
              <span>FINAL DESIGN</span>
              <small>{String(FINAL_SCREENS.length).padStart(2, "0")}</small>
            </div>
            <div className="layout-list final-layout-list">
              {FINAL_SCREENS.map((screen) => (
                <button
                  key={screen.id}
                  className={`layout-option final-layout-option ${
                    selectedId === screen.id ? "active" : ""
                  }`}
                  onClick={() => navigateFinal(screen.id)}
                  aria-pressed={selectedId === screen.id}
                >
                  <span className="layout-number">{screen.number}</span>
                  <span>
                    <strong>{screen.name}</strong>
                    <small>{screen.summary}</small>
                  </span>
                  <span className="layout-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>

          <section className="concept-group ideas-group">
            <div className="concept-group-heading">
              <span>IDEAS</span>
              <small>{String(LAYOUTS.length).padStart(2, "0")}</small>
            </div>
            <div className="layout-list ideas-layout-list">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  className={`layout-option ${
                    selectedId === layout.id ? "active" : ""
                  }`}
                  onClick={() => setSelectedId(layout.id)}
                  aria-pressed={selectedId === layout.id}
                >
                  <span className="layout-number">{layout.number}</span>
                  <span>
                    <strong>{layout.name}</strong>
                    <small>{layout.summary}</small>
                  </span>
                  <span className="layout-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>
        </nav>

        <div className="sidebar-note">
          <span className="note-dot" />
          <span>
            <strong>Interactive prototype</strong>
            <small>Reps, load and timer are shared across all concepts.</small>
          </span>
        </div>
      </aside>

      <section className="stage" id="top">
        <header className="stage-header">
          <div>
            <span className="section-kicker">
              {isFinalDesign ? "FINAL DESIGN" : "IDEA"} · APPLE WATCH · 45 MM
            </span>
            <h2>{selected.name}</h2>
          </div>
          <span className="concept-count">
            {String(selectedIndex).padStart(2, "0")}{" "}
            <i>/ {String(selectedGroupLength).padStart(2, "0")}</i>
          </span>
        </header>

        <div className="stage-content">
          <div className="watch-presentation" key={selectedId}>
            <span className="axis-line axis-x" />
            <span className="axis-line axis-y" />
            <span className="measurement measurement-width">396 PX</span>
            <span className="measurement measurement-height">484 PX</span>

            <div className="watch-shadow" />
            {isFinalDesign
              ? renderFinalWatch(
                  selected.id as FinalScreenOption["id"],
                  finalProps
                )
              : renderWatch(selected.id as LayoutOption["id"], sharedProps)}

            {!isFinalDesign && confirmation && (
              <div className="set-toast" role="status">
                <CheckIcon />
                Set logged
              </div>
            )}
          </div>

          {isFinalDesign ? (
            <div className="concept-details final-canvas-details">
              <div className="principle">
                <span>FINAL FLOW</span>
                <strong>{selected.name}</strong>
              </div>

              <div className="canvas-state">
                <span className="canvas-state-dot" />
                <span>
                  <strong>Interactive screen</strong>
                  <small>{(selected as FinalScreenOption).canvasNote}</small>
                </span>
              </div>

              <p className="interaction-hint">
                <span>FLOW</span>
                Navigate directly inside the watch. Saving a set starts rest;
                heart rate opens from the live workout and returns where you
                left off.
              </p>
            </div>
          ) : (
            <div className="concept-details">
              <div className="principle">
                <span>DESIGN PRINCIPLE</span>
                <strong>{(selected as LayoutOption).principle}</strong>
              </div>

              <div className="detail-grid">
                <div>
                  <span>LIVE SET</span>
                  <strong>{reps} reps</strong>
                </div>
                <div>
                  <span>LOAD</span>
                  <strong>{weight} kg</strong>
                </div>
                <div>
                  <span>REST</span>
                  <strong>{formatTime(rest)}</strong>
                </div>
              </div>

              <p className="interaction-hint">
                <span>TRY IT</span>
                {(selected as LayoutOption).hint}
              </p>
            </div>
          )}
        </div>

        <footer className="stage-footer">
          <span>WORKOUT APP · INTERACTION STUDY</span>
          <span>JUL 2026</span>
        </footer>
      </section>
    </main>
  );
}
