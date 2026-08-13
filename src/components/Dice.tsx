import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { DICE_SETTLE_S, DICE_TUMBLE_S } from '../ui/motion';

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

const FACE_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

function FacePips({ value, soft = false }: { value: number; soft?: boolean }) {
  const dots = FACE_DOTS[value]!;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full p-[14%]">
      {dots.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x + 1.2} cy={y + 1.8} r={9} fill="rgba(0,0,0,0.18)" />
          <circle cx={x} cy={y} r={8.5} fill={soft ? 'rgba(21,32,51,0.2)' : '#1a2433'} />
          {!soft && (
            <circle cx={x - 2.2} cy={y - 2.5} r={2.4} fill="rgba(255,255,255,0.35)" />
          )}
        </g>
      ))}
    </svg>
  );
}

function DiceFace({
  value,
  transform,
  soft,
}: {
  value: number;
  transform: string;
  soft?: boolean;
}) {
  return (
    <div className="dice-face-3d" style={{ transform }} aria-hidden>
      <FacePips value={value} soft={soft} />
    </div>
  );
}

interface Props {
  value: number | null;
  lastValue?: number | null;
  rolling?: boolean;
  disabled?: boolean;
  onRoll: () => void;
  spin?: { x: number; y: number };
  hint?: string | null;
  extraRoll?: boolean;
  timerFraction?: number | null;
}

export function Dice({
  value,
  lastValue = null,
  rolling,
  disabled,
  onRoll,
  spin = { x: 400, y: -520 },
  hint,
  extraRoll,
  timerFraction = null,
}: Props) {
  const [shown, setShown] = useState(value ?? lastValue ?? 1);

  useEffect(() => {
    if (value !== null) setShown(value);
    else if (lastValue !== null) setShown(lastValue);
  }, [value, lastValue]);

  const settled = FACE_ROTATION[shown]!;
  const soft = value === null && lastValue === null && !rolling;
  const isSix = shown === 6 && !rolling && !soft;

  const caption = rolling
    ? 'Rolling…'
    : hint
      ? hint
      : extraRoll
        ? 'Roll again'
        : disabled
          ? value || lastValue
            ? `Rolled ${shown}`
            : 'Wait'
          : value
            ? `Rolled ${value}`
            : 'Tap to roll';

  const shownValue = value !== null && !rolling ? value : lastValue !== null && !rolling ? lastValue : null;

  return (
    <motion.button
      type="button"
      onClick={onRoll}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      className="relative disabled:opacity-50"
      data-testid="dice-button"
      aria-label={
        rolling
          ? 'Dice rolling'
          : shownValue
            ? `Dice showing ${shownValue}. Click to roll.`
            : 'Roll dice'
      }
    >
      {timerFraction !== null && (
        <svg className="turn-timer-ring" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="16" className="turn-timer-track" />
          <circle
            cx="18"
            cy="18"
            r="16"
            className="turn-timer-value"
            style={{
              strokeDasharray: `${timerFraction * 100.5} 100.5`,
              stroke: timerFraction < 0.2 ? 'var(--danger)' : 'var(--accent)',
            }}
          />
        </svg>
      )}
      <div className="dice-scene" data-rolling={rolling ? 'true' : 'false'} data-six={isSix ? 'true' : 'false'}>
        <motion.div
          className="dice-cube"
          style={{ transformStyle: 'preserve-3d' }}
          animate={
            rolling
              ? {
                  rotateX: [settled.x, settled.x + spin.x, settled.x + spin.x * 1.9],
                  rotateY: [settled.y, settled.y + spin.y, settled.y + spin.y * 2],
                  z: [0, 28, 0],
                }
              : {
                  rotateX: settled.x,
                  rotateY: settled.y,
                  z: 0,
                }
          }
          transition={{
            duration: rolling ? DICE_TUMBLE_S : DICE_SETTLE_S,
            ease: rolling ? [0.2, 0.8, 0.2, 1] : 'easeOut',
          }}
          data-testid="dice-face"
          data-value={shownValue !== null ? String(shownValue) : ''}
          data-six={isSix ? 'true' : 'false'}
        >
          <DiceFace value={1} transform="translateZ(var(--dice-z))" soft={soft} />
          <DiceFace value={6} transform="rotateY(180deg) translateZ(var(--dice-z))" soft={soft} />
          <DiceFace value={5} transform="rotateY(-90deg) translateZ(var(--dice-z))" soft={soft} />
          <DiceFace value={2} transform="rotateY(90deg) translateZ(var(--dice-z))" soft={soft} />
          <DiceFace value={3} transform="rotateX(90deg) translateZ(var(--dice-z))" soft={soft} />
          <DiceFace value={4} transform="rotateX(-90deg) translateZ(var(--dice-z))" soft={soft} />
        </motion.div>
        <div className="dice-floor-shadow" aria-hidden />
      </div>
      <span className="mt-2 block text-center text-xs" style={{ color: extraRoll || hint ? 'var(--accent)' : 'var(--muted)' }}>
        {caption}
      </span>
    </motion.button>
  );
}
