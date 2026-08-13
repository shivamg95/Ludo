import { motion } from 'motion/react';
import type { SeatColor } from '../engine/types';
import { SEAT_RAMP } from '../theme/seats';
import { DUR, SPRING, useReducedMotion } from '../ui/motion';

const FACE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [28, 72],
    [72, 28],
    [72, 72],
  ],
  5: [
    [28, 28],
    [28, 72],
    [50, 50],
    [72, 28],
    [72, 72],
  ],
  6: [
    [28, 28],
    [28, 50],
    [28, 72],
    [72, 28],
    [72, 50],
    [72, 72],
  ],
};

/** Camera rotation that brings each face to the front. */
const FACE_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

/** Deterministic per-value tilt, so screenshots stay stable across runs. */
function tiltFor(value: number): number {
  return ((value * 37) % 11) - 5;
}

function FacePips({ value, color }: { value: number; color: string }) {
  const dots = FACE_DOTS[value]!;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full p-[14%]" aria-hidden>
      {dots.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={11} fill={color} opacity={0.22} />
          <circle cx={x} cy={y} r={7.6} fill={color} />
          <circle cx={x - 2.2} cy={y - 2.6} r={2.2} fill="#fff" opacity={0.75} />
        </g>
      ))}
    </svg>
  );
}

function DiceFace({ value, transform, color }: { value: number; transform: string; color: string }) {
  return (
    <div className="dice-face-3d" style={{ transform }} aria-hidden>
      <FacePips value={value} color={color} />
    </div>
  );
}

interface Props {
  /** The live roll, cleared by the engine as soon as a move is applied. */
  value: number | null;
  /** Face the cube rests on. Outlives `value` so the die never snaps back to 1. */
  face?: number | null;
  rolling?: boolean;
  disabled?: boolean;
  onRoll: () => void;
  seatColor?: SeatColor;
  /** Copy shown under the die when the player cannot roll. */
  waitingLabel?: string;
}

export function Dice({
  value,
  face,
  rolling,
  disabled,
  onRoll,
  seatColor = 'red',
  waitingLabel = 'Wait',
}: Props) {
  const reduced = useReducedMotion();
  const showValue = face ?? value ?? 1;
  const settled = FACE_ROTATION[showValue]!;
  const ramp = SEAT_RAMP[seatColor];
  const ready = !disabled && !rolling;

  const cubeAnimate = rolling
    ? {
        rotateX: [settled.x - 720, settled.x - 360, settled.x],
        rotateY: [settled.y + 900, settled.y + 420, settled.y],
        rotateZ: [0, 18, tiltFor(showValue)],
      }
    : { rotateX: settled.x, rotateY: settled.y, rotateZ: tiltFor(showValue) };

  const liftAnimate = rolling ? { y: [0, -58, 0, -13, 0], scaleY: [1, 1.06, 0.86, 1.02, 1] } : { y: 0, scaleY: 1 };

  const shadowAnimate = rolling
    ? { scaleX: [1, 0.55, 1.12, 0.82, 1], opacity: [0.7, 0.25, 0.85, 0.45, 0.7] }
    : { scaleX: 1, opacity: 0.7 };

  const tossTiming = { duration: DUR.roll, times: [0, 0.35, 0.68, 0.85, 1], ease: 'easeInOut' as const };

  return (
    <div className={`dice-hero seat-${seatColor}`} data-testid="dice-hero">
      <button
        type="button"
        onClick={onRoll}
        disabled={disabled}
        className="dice-button"
        data-testid="dice-button"
        data-ready={ready ? 'true' : 'false'}
        aria-label={
          rolling
            ? 'Dice rolling'
            : disabled
              ? `Dice showing ${showValue}`
              : `Roll dice, showing ${showValue}`
        }
      >
        <div className="dice-scene">
          {/* Affordance ring — only this dims when you cannot roll */}
          {ready && (
            <motion.span
              className="dice-ready-ring"
              aria-hidden
              initial={false}
              animate={reduced ? { opacity: 0.5, scale: 1 } : { opacity: [0.25, 0.7, 0.25], scale: [1, 1.06, 1] }}
              transition={reduced ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          <motion.div
            className="dice-lift"
            initial={false}
            animate={reduced ? { y: 0, scaleY: 1 } : liftAnimate}
            transition={reduced ? { duration: 0 } : tossTiming}
          >
            <motion.div
              className="dice-cube"
              initial={false}
              animate={reduced ? { rotateX: settled.x, rotateY: settled.y, rotateZ: 0 } : cubeAnimate}
              transition={
                reduced
                  ? { duration: 0 }
                  : rolling
                    ? { duration: DUR.roll, ease: [0.16, 0.7, 0.24, 1] }
                    : SPRING.tight
              }
              data-testid="dice-face"
              data-value={rolling ? '' : String(showValue)}
            >
              <DiceFace value={1} transform="translateZ(var(--dice-z))" color={ramp.core} />
              <DiceFace
                value={6}
                transform="rotateY(180deg) translateZ(var(--dice-z))"
                color={ramp.core}
              />
              <DiceFace
                value={5}
                transform="rotateY(-90deg) translateZ(var(--dice-z))"
                color={ramp.core}
              />
              <DiceFace
                value={2}
                transform="rotateY(90deg) translateZ(var(--dice-z))"
                color={ramp.core}
              />
              <DiceFace
                value={3}
                transform="rotateX(90deg) translateZ(var(--dice-z))"
                color={ramp.core}
              />
              <DiceFace
                value={4}
                transform="rotateX(-90deg) translateZ(var(--dice-z))"
                color={ramp.core}
              />
            </motion.div>
          </motion.div>

          <motion.div
            className="dice-floor-shadow"
            aria-hidden
            initial={false}
            animate={reduced ? { scaleX: 1, opacity: 0.7 } : shadowAnimate}
            transition={reduced ? { duration: 0 } : tossTiming}
          />
        </div>
      </button>

      <span className="dice-caption" data-testid="dice-caption">
        {rolling ? (
          'Rolling…'
        ) : value !== null ? (
          <>
            Rolled <strong className="dice-caption-value">{value}</strong>
          </>
        ) : disabled ? (
          waitingLabel
        ) : (
          'Tap to roll'
        )}
      </span>
    </div>
  );
}
