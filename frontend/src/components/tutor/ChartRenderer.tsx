import type { ChartSpec } from '../../features/tutor/tutor.schema.js';

const WIDTH = 320;
const HEIGHT = 200;
const PADDING = 32;

const colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2'];

export const ChartRenderer = ({ spec }: { spec: ChartSpec }) => {
  const allPoints = spec.series.flatMap((s) => s.points);
  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(...ys);

  const scaleX = (x: number) =>
    PADDING + ((x - xMin) / (xMax - xMin || 1)) * (WIDTH - 2 * PADDING);
  const scaleY = (y: number) =>
    HEIGHT - PADDING - ((y - yMin) / (yMax - yMin || 1)) * (HEIGHT - 2 * PADDING);

  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <p className="mb-2 text-sm font-medium text-fg">{spec.title}</p>
      <svg width={WIDTH} height={HEIGHT} role="img" aria-label={spec.title}>
        <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="currentColor" className="text-border" />
        <line x1={PADDING} y1={PADDING} x2={PADDING} y2={HEIGHT - PADDING} stroke="currentColor" className="text-border" />

        {spec.series.map((series, si) => {
          const color = colors[si % colors.length];
          const sorted = [...series.points].sort((a, b) => a.x - b.x);

          if (spec.type === 'bar') {
            const barWidth = (WIDTH - 2 * PADDING) / sorted.length / 1.5;
            return (
              <g key={series.name}>
                {sorted.map((p, i) => (
                  <rect
                    key={i}
                    x={scaleX(p.x) - barWidth / 2}
                    y={scaleY(p.y)}
                    width={barWidth}
                    height={HEIGHT - PADDING - scaleY(p.y)}
                    fill={color}
                  />
                ))}
              </g>
            );
          }

          if (spec.type === 'scatter') {
            return (
              <g key={series.name}>
                {sorted.map((p, i) => (
                  <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={3} fill={color} />
                ))}
              </g>
            );
          }

          // 'line' and 'function' both render as a connected polyline.
          const d = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');
          return <path key={series.name} d={d} fill="none" stroke={color} strokeWidth={2} />;
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
        {spec.series.map((series, si) => (
          <span key={series.name} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: colors[si % colors.length] }} />
            {series.name}
          </span>
        ))}
      </div>
    </div>
  );
};
