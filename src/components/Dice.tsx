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

interface Props {
  value: number | null;
  rolling?: boolean;
  disabled?: boolean;
  onRoll: () => void;
}

export function Dice({ value, rolling, disabled, onRoll }: Props) {
  const dots = value ? FACE_DOTS[value] : FACE_DOTS[1];

  return (
    <button
      type="button"
      onClick={onRoll}
      disabled={disabled}
      className="relative disabled:opacity-50"
      data-testid="dice-button"
      aria-label={value ? `Dice showing ${value}. Click to roll.` : 'Roll dice'}
      style={{ perspective: 600 }}
    >
      <motion.div
        className="relative h-20 w-20 rounded-2xl"
        style={{
          background: 'linear-gradient(145deg, #f8fafc, #d9e2ec)',
          boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.7), 0 10px 24px rgba(0,0,0,0.35)',
          transformStyle: 'preserve-3d',
        }}
        animate={
          rolling
            ? { rotateX: 360, rotateY: 420, scale: [1, 1.08, 1] }
            : { rotateX: 0, rotateY: 0, scale: 1 }
        }
        transition={{ duration: rolling ? 0.55 : 0.25, ease: 'easeOut' }}
        data-testid="dice-face"
        data-value={value ?? ''}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full p-2">
          {dots!.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={8} fill="#152033" />
          ))}
        </svg>
      </motion.div>
      <span className="mt-2 block text-center text-xs" style={{ color: 'var(--muted)' }}>
        {disabled ? 'Wait' : value ? `Rolled ${value}` : 'Tap to roll'}
      </span>
    </button>
  );
}
