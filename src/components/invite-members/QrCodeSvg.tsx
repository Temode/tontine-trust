import { useMemo } from "react";

interface QrCodeSvgProps {
  /** Value encoded into a deterministic visual grid. Not a real QR. */
  value: string;
  size?: number;
  className?: string;
}

const GRID = 25;

/** Hash-based PRNG so the same value always produces the same pattern. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Render a stylised QR-like marker with three finder squares and a deterministic
 * pseudo-random data field. Visually unmistakable as a QR code without depending
 * on a heavy library — appropriate for mock/demo purposes.
 */
export function QrCodeSvg({ value, size = 192, className }: QrCodeSvgProps) {
  const cells = useMemo(() => {
    const rng = mulberry32(hashCode(value || "TD"));
    const matrix: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        matrix[r][c] = rng() > 0.55;
      }
    }
    // Carve out finder pattern zones (top-left, top-right, bottom-left).
    const carve = (r0: number, c0: number) => {
      for (let r = r0; r < r0 + 7; r++) {
        for (let c = c0; c < c0 + 7; c++) {
          matrix[r][c] = false;
        }
      }
    };
    carve(0, 0);
    carve(0, GRID - 7);
    carve(GRID - 7, 0);
    return matrix;
  }, [value]);

  const cell = size / GRID;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`QR Code · ${value}`}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="hsl(var(--card))" />

      {/* Data cells */}
      {cells.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell}
              height={cell}
              fill="hsl(var(--foreground))"
            />
          ) : null,
        ),
      )}

      {/* Finder patterns */}
      <FinderPattern x={0} y={0} cell={cell} />
      <FinderPattern x={(GRID - 7) * cell} y={0} cell={cell} />
      <FinderPattern x={0} y={(GRID - 7) * cell} cell={cell} />
    </svg>
  );
}

function FinderPattern({ x, y, cell }: { x: number; y: number; cell: number }) {
  const fg = "hsl(var(--foreground))";
  const bg = "hsl(var(--card))";
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width={7 * cell} height={7 * cell} fill={fg} />
      <rect x={cell} y={cell} width={5 * cell} height={5 * cell} fill={bg} />
      <rect x={2 * cell} y={2 * cell} width={3 * cell} height={3 * cell} fill={fg} />
    </g>
  );
}
