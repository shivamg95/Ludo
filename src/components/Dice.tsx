import { motion } from 'motion/react';

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
  rolling?: boolean;
  disabled?: boolean;
  onRoll: () => void;
}

export function Dice({ value, rolling, disabled, onRoll }: Props) {
  const showValue = value !== null ? value : 1;
  const settled = FACE_ROTATION[showValue]!;
  const soft = value === null && !rolling;

  return (
    <button
      type="button"
      onClick={onRoll}
      disabled={disabled}
      className="relative disabled:opacity-50"
      data-testid="dice-button"
      aria-label={
        rolling
          ? 'Dice rolling'
          : value
            ? `Dice showing ${value}. Click to roll.`
            : 'Roll dice'
      }
    >
      <div className="dice-scene">
        <motion.div
          className="dice-cube"
          style={{ transformStyle: 'preserve-3d' }}
          animate={
            rolling
              ? {
                  rotateX: [settled.x, settled.x + 400, settled.x + 760],
                  rotateY: [settled.y, settled.y - 520, settled.y - 1040],
                  z: [0, 28, 0],
                }
              : {
                  rotateX: settled.x,
                  rotateY: settled.y,
                  z: 0,
                }
          }
          transition={{
            duration: rolling ? 0.65 : 0.35,
            ease: rolling ? [0.2, 0.8, 0.2, 1] : 'easeOut',
          }}
          data-testid="dice-face"
          data-value={value !== null && !rolling ? String(value) : ''}
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
      <span className="mt-2 block text-center text-xs" style={{ color: 'var(--muted)' }}>
        {rolling ? 'Rolling…' : disabled ? 'Wait' : value ? `Rolled ${value}` : 'Tap to roll'}
      </span>
    </button>
  );
}
