'use client';

import type { FunctionalDependency } from '@/types/normalizer';
import { cn } from '@/lib/utils/helpers';

interface DependencyDiagramProps {
  columns: string[];
  fds: FunctionalDependency[];
  className?: string;
}

export function DependencyDiagram({ columns, fds, className }: DependencyDiagramProps) {
  if (columns.length === 0) return null;

  const colW = 70;
  const padding = 40;
  const svgW = columns.length * colW + padding * 2;
  const svgH = 60 + fds.length * 40;

  return (
    <div className={cn('overflow-auto rounded-lg border border-border bg-card', className)}>
      <div className="border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Dependency Diagram
        </span>
      </div>
      <svg width={svgW} height={svgH} className="mx-auto block p-2">
        {/* Column labels */}
        {columns.map((col, i) => (
          <text
            key={col}
            x={padding + i * colW + colW / 2}
            y={25}
            textAnchor="middle"
            className="fill-foreground text-xs font-bold"
          >
            {col}
          </text>
        ))}
        {/* Line under columns */}
        <line
          x1={padding}
          y1={35}
          x2={padding + columns.length * colW}
          y2={35}
          className="stroke-border"
          strokeWidth={1}
        />
        {/* FD arrows */}
        {fds.map((fd, i) => {
          const y = 55 + i * 35;
          const detIndices = fd.determinant.map((d) => columns.indexOf(d)).filter((x) => x >= 0);
          const depIndices = fd.dependent.map((d) => columns.indexOf(d)).filter((x) => x >= 0);
          if (detIndices.length === 0 || depIndices.length === 0) return null;

          const detX = padding + (Math.min(...detIndices) + Math.max(...detIndices)) / 2 * colW + colW / 2;
          const depX = padding + (Math.min(...depIndices) + Math.max(...depIndices)) / 2 * colW + colW / 2;

          return (
            <g key={i}>
              {/* Determinant bracket */}
              {detIndices.map((di) => (
                <line
                  key={`d-${di}`}
                  x1={padding + di * colW + colW / 2}
                  y1={35}
                  x2={padding + di * colW + colW / 2}
                  y2={y - 5}
                  className="stroke-primary"
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                />
              ))}
              {/* Arrow */}
              <line
                x1={detX}
                y1={y}
                x2={depX}
                y2={y}
                className="stroke-primary"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
              {/* Dependent dots */}
              {depIndices.map((di) => (
                <line
                  key={`dep-${di}`}
                  x1={padding + di * colW + colW / 2}
                  y1={y}
                  x2={padding + di * colW + colW / 2}
                  y2={y + 10}
                  className="stroke-green-500"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })}
        {/* Arrow marker */}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" className="fill-primary" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
