'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

interface VolumePoint {
  label: string;
  usdc: number;
  ngn: number;
}

export function VolumeAreaChart({ data, className }: { data: VolumePoint[]; className?: string }) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.usdc));
  const minVal = Math.min(...data.map((d) => d.usdc)) * 0.8;
  const range = maxVal - minVal || 1;

  const width = 600;
  const height = 180;
  const padding = 20;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.usdc - minVal) / range) * (height - padding * 2);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className={cn('relative w-full overflow-hidden', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = height - padding - p * (height - padding * 2);
          return (
            <line
              key={i}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#chartGradient)" />

        {/* Line curve */}
        <path d={pathD} fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 6 : 4}
              className="fill-background stroke-silver-300 transition-all cursor-pointer"
              strokeWidth="2"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          </g>
        ))}
      </svg>

      {/* Days row */}
      <div className="flex justify-between px-2 text-[11px] font-mono text-muted-foreground mt-2 border-t border-border/40 pt-2">
        {data.map((d, i) => (
          <span key={i} className={cn(hoveredIdx === i && 'text-foreground font-bold')}>
            {d.label}
          </span>
        ))}
      </div>

      {hoveredIdx !== null && (
        <div className="absolute top-2 right-4 rounded-xl border border-border/80 bg-card/95 px-3 py-1.5 text-xs shadow-glow backdrop-blur-md">
          <p className="font-semibold text-foreground">{data[hoveredIdx].label} Volume</p>
          <p className="font-mono text-emerald-400 font-bold">
            ${data[hoveredIdx].usdc.toLocaleString()} USDC (₦{(data[hoveredIdx].ngn / 1_000_000).toFixed(2)}M)
          </p>
        </div>
      )}
    </div>
  );
}
