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
  const showFace = value !== null && !rolling;
  const dots = showFace ? FACE_DOTS[value] : null;

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
      style={{ perspective: 800 }}
    >
      <motion.div
        className="relative h-20 w-20 rounded-2xl"
        style={{
          background: 'linear-gradient(145deg, #ffffff, #d5dee8)',
          boxShadow:
            'inset 0 2px 6px rgba(255,255,255,0.85), inset 0 -3px 8px rgba(0,0,0,0.12), 0 12px 28px rgba(0,0,0,0.4)',
          transformStyle: 'preserve-3d',
        }}
        animate={
          rolling
            ? { rotateX: [0, 360, 720], rotateY: [0, 420, 780], scale: [1, 1.1, 1] }
            : { rotateX: 0, rotateY: 0, scale: 1 }
        }
        transition={{ duration: rolling ? 0.55 : 0.25, ease: 'easeOut' }}
        data-testid="dice-face"
        data-value={showFace ? String(value) : ''}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full p-2">
          {dots ? (
            dots.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={8} fill="#152033" />
            ))
          ) : (
            <>
              {[
                [28, 28],
                [28, 50],
                [28, 72],
                [72, 28],
                [72, 50],
                [72, 72],
              ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={6} fill="#152033" opacity={0.12} />
              ))}
            </>
          )}
        </svg>
      </motion.div>
      <span className="mt-2 block text-center text-xs" style={{ color: 'var(--muted)' }}>
        {rolling ? 'Rolling…' : disabled ? 'Wait' : value ? `Rolled ${value}` : 'Tap to roll'}
      </span>
    </button>
  );
}
