"use client";

import { useRef, useState } from "react";

export interface ChartPoint { label: string; value: number }

const WIDTH = 720;
const HEIGHT = 260;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const PAD_TOP = 20;
const PAD_BOTTOM = 34;

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const step = Math.pow(10, Math.floor(Math.log10(max / count)));
  const normalized = max / count / step;
  const niceStep = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= max + niceStep * 0.01; value += niceStep) ticks.push(Math.round(value * 100) / 100);
  return ticks;
}

// Single-series line + area chart, no external library. A single series
// carries no legend box (the card title names it) — per dataviz spec: 2px
// line, ~10% area wash, hairline recessive gridlines, endpoint direct
// label, and a hover crosshair + tooltip readable at any point.
export function EarningsChart({ points, formatValue }: { points: ChartPoint[]; formatValue: (value: number) => string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length === 0) {
    return <div className="chart-empty">No data in this range yet.</div>;
  }

  const maxValue = Math.max(...points.map((point) => point.value), 0);
  const ticks = niceTicks(maxValue);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (index: number) => (points.length === 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (index / (points.length - 1)) * plotWidth);
  const yFor = (value: number) => PAD_TOP + plotHeight - (value / scaleMax) * plotHeight;

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index).toFixed(1)},${yFor(point.value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xFor(points.length - 1).toFixed(1)},${(PAD_TOP + plotHeight).toFixed(1)} L${xFor(0).toFixed(1)},${(PAD_TOP + plotHeight).toFixed(1)} Z`;

  const last = points[points.length - 1];
  const active = hoverIndex !== null ? points[hoverIndex] : null;

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let closestDistance = Infinity;
    points.forEach((_, index) => {
      const distance = Math.abs(xFor(index) - relativeX);
      if (distance < closestDistance) { closestDistance = distance; closest = index; }
    });
    setHoverIndex(closest);
  }

  return (
    <div className="earnings-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Trend from ${points[0].label} to ${last.label}, ending at ${formatValue(last.value)}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(tick)} y2={yFor(tick)} />
            <text className="chart-axis-label" x={PAD_LEFT - 8} y={yFor(tick) + 3} textAnchor="end">{formatValue(tick)}</text>
          </g>
        ))}

        <path className="chart-area" d={areaPath} />
        <path className="chart-line" d={linePath} fill="none" />

        {active === null && (
          <>
            <circle className="chart-end-ring" cx={xFor(points.length - 1)} cy={yFor(last.value)} r={6} />
            <circle className="chart-end-dot" cx={xFor(points.length - 1)} cy={yFor(last.value)} r={4} />
            <text className="chart-end-label" x={xFor(points.length - 1) - 8} y={yFor(last.value) - 12} textAnchor="end">{formatValue(last.value)}</text>
          </>
        )}

        {active !== null && hoverIndex !== null && (
          <>
            <line className="chart-crosshair" x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={PAD_TOP} y2={PAD_TOP + plotHeight} />
            <circle className="chart-end-ring" cx={xFor(hoverIndex)} cy={yFor(active.value)} r={6} />
            <circle className="chart-end-dot" cx={xFor(hoverIndex)} cy={yFor(active.value)} r={4} />
          </>
        )}

        <text className="chart-axis-label" x={PAD_LEFT} y={HEIGHT - 6}>{points[0].label}</text>
        <text className="chart-axis-label" x={WIDTH - PAD_RIGHT} y={HEIGHT - 6} textAnchor="end">{last.label}</text>
      </svg>

      {active !== null && (
        <div className="chart-tooltip" style={{ left: `${(xFor(hoverIndex!) / WIDTH) * 100}%` }}>
          <strong>{formatValue(active.value)}</strong>
          <span>{active.label}</span>
        </div>
      )}
    </div>
  );
}
