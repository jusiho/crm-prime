/**
 * Anillo de progreso. Lo que va dentro (cifra, icono) lo pone quien lo usa.
 * El trazo se anima al cambiar: completar un paso se ve, no solo se lee.
 */
export function ProgressRing({
  pct,
  size,
  stroke = 3,
  children,
  className,
}: {
  pct: number;
  size: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <span className={`ring${className ? ` ${className}` : ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={clamped >= 1 ? "var(--positive)" : "var(--accent-2)"}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring__arc"
        />
      </svg>
      <span className="ring__inner">{children}</span>
    </span>
  );
}
