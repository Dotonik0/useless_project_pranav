import React, { useMemo } from 'react';

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  unit?: string;
}

/** Live scrolling line graph with glowing head dot + area fill. */
export const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 220,
  height = 56,
  stroke = '#ff1e27',
  unit,
}) => {
  const { line, area, head, max } = useMemo(() => {
    const maxV = Math.max(...values, 1);
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    const pts = values.map((v, i) => {
      const x = i * stepX;
      const y = height - 4 - (v / maxV) * (height - 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const last = pts[pts.length - 1]?.split(',').map(Number) ?? [width, height];
    return {
      line: pts.join(' '),
      area: `0,${height} ${pts.join(' ')} ${width},${height}`,
      head: { x: last[0], y: last[1] },
      max: maxV,
    };
  }, [values, width, height]);

  const gid = useMemo(() => `sg${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="block" preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="#1e2430" strokeWidth="1" />
        ))}
        <polygon points={area} fill={`url(#${gid})`} />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={head.x} cy={head.y} r="3" fill={stroke} style={{ filter: `drop-shadow(0 0 4px ${stroke})` }} />
      </svg>
      {unit && (
        <span className="absolute top-0 right-1 text-[8px] font-mono text-slate-500">
          MAX {max.toFixed(0)} {unit}
        </span>
      )}
    </div>
  );
};
