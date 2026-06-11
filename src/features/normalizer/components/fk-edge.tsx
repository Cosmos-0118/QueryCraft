'use client';

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

interface FKData {
    label?: string;
    keyReference?: boolean;
}

function parseFKData(data: unknown): FKData {
    if (!data || typeof data !== 'object') {
        return {};
    }

    const value = data as Record<string, unknown>;
    return {
        label: typeof value.label === 'string' ? value.label : undefined,
        keyReference: typeof value.keyReference === 'boolean' ? value.keyReference : undefined,
    };
}

export function FKEdge(props: EdgeProps) {
    const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
    const fkData = parseFKData(data);

    const [path, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 12,
    });

    const isKeyReference = fkData.keyReference ?? true;

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                style={{
                    stroke: isKeyReference
                        ? 'color-mix(in oklab, var(--accent) 64%, #8b5cf6)'
                        : 'color-mix(in oklab, var(--muted-foreground) 55%, var(--border))',
                    strokeWidth: isKeyReference ? 1.7 : 1.4,
                    strokeDasharray: '7 6',
                    opacity: 0.88,
                    animation: 'dash-flow 0.9s linear infinite',
                }}
            />

            {fkData.label && (
                <EdgeLabelRenderer>
                    <div
                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-[10px] font-semibold"
                        style={{
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            borderColor: isKeyReference
                                ? 'color-mix(in oklab, var(--accent) 44%, var(--border))'
                                : 'color-mix(in oklab, var(--border) 85%, transparent)',
                            background: 'color-mix(in oklab, var(--card) 92%, transparent)',
                            color: isKeyReference ? 'color-mix(in oklab, var(--accent) 70%, var(--foreground))' : 'var(--muted-foreground)',
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        {fkData.label}
                    </div>
                </EdgeLabelRenderer>
            )}

            <style>{`@keyframes dash-flow { to { stroke-dashoffset: -13; } }`}</style>
        </>
    );
}
