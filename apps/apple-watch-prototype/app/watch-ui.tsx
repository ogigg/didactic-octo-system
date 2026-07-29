"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";

export const REST_DURATION = 90;
export const TOTAL_SETS = 4;

export function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.6 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19.5 6.5" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  );
}

export function ForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="icon-filled" aria-hidden="true">
      <path d="M8 5.5 19 12 8 18.5Z" />
    </svg>
  );
}

export function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h9.5a5.5 5.5 0 1 1 0 11H9M4 9l4-4M4 9l4 4" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9.5 19h5M12 14v5" />
    </svg>
  );
}

export function WatchStatus() {
  return (
    <div className="watch-status">
      <span>10:09</span>
      <span className="status-dot" />
    </div>
  );
}

const CROWN_STEP_PX = 11;

export interface WatchShellProps {
  children: ReactNode;
  crownActive?: boolean;
  onCrownClick?: () => void;
  /** Simulated Digital Crown rotation. 1 is a turn away from the wearer. */
  onCrownDelta?: (direction: 1 | -1) => void;
  crownLabel?: string;
}

export function WatchShell({
  children,
  crownActive = false,
  onCrownClick,
  onCrownDelta,
  crownLabel,
}: WatchShellProps) {
  const dragOrigin = useRef<number | null>(null);
  const wheelAccumulator = useRef(0);
  const spinTimeout = useRef<number | null>(null);
  const [spinning, setSpinning] = useState(false);

  useEffect(
    () => () => {
      if (spinTimeout.current) window.clearTimeout(spinTimeout.current);
    },
    []
  );

  const emit = useCallback(
    (direction: 1 | -1) => {
      if (!onCrownDelta) return;
      onCrownDelta(direction);
      setSpinning(true);
      if (spinTimeout.current) window.clearTimeout(spinTimeout.current);
      spinTimeout.current = window.setTimeout(() => setSpinning(false), 200);
    },
    [onCrownDelta]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!onCrownDelta) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = event.clientY;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!onCrownDelta || dragOrigin.current === null) return;
    const delta = dragOrigin.current - event.clientY;
    if (Math.abs(delta) < CROWN_STEP_PX) return;
    const steps = Math.trunc(delta / CROWN_STEP_PX);
    dragOrigin.current = event.clientY;
    for (let index = 0; index < Math.min(Math.abs(steps), 4); index += 1) {
      emit(steps > 0 ? 1 : -1);
    }
  };

  const endDrag = () => {
    dragOrigin.current = null;
  };

  const handleWheel = (event: ReactWheelEvent<HTMLButtonElement>) => {
    if (!onCrownDelta) return;
    wheelAccumulator.current += event.deltaY;
    while (Math.abs(wheelAccumulator.current) >= 24) {
      const direction = wheelAccumulator.current > 0 ? -1 : 1;
      wheelAccumulator.current += direction * 24;
      emit(direction);
    }
  };

  const interactive = Boolean(onCrownClick || onCrownDelta);

  return (
    <div className="watch-frame">
      {interactive ? (
        <button
          type="button"
          className={`watch-crown interactive ${crownActive ? "active" : ""} ${
            spinning ? "spinning" : ""
          }`}
          aria-label={crownLabel ?? "Turn Digital Crown"}
          onClick={onCrownClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={handleWheel}
          onKeyDown={(event) => {
            if (!onCrownDelta) return;
            if (event.key === "ArrowUp" || event.key === "ArrowRight") {
              event.preventDefault();
              emit(1);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
              event.preventDefault();
              emit(-1);
            }
          }}
        />
      ) : (
        <div className="watch-crown" />
      )}
      <div className="watch-button" />
      <div className="watch-glass">{children}</div>
    </div>
  );
}
