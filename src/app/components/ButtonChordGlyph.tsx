import type { CSSProperties } from 'react';

export type ChordNode = 'top' | 'left' | 'right';

type Props = {
  filled?: readonly ChordNode[];
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeColor?: string;
  fillColor?: string;
  nodeLabels?: Partial<Record<ChordNode, string>>;
  ariaLabel?: string;
};

const CIRCLE_LAYOUT: Record<ChordNode, { cx: number; cy: number }> = {
  top: { cx: 30, cy: 12 },
  left: { cx: 12, cy: 40 },
  right: { cx: 48, cy: 40 },
};

const LABEL_LAYOUT: Record<ChordNode, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }> = {
  top: { x: 30, y: 2, anchor: 'middle' },
  left: { x: 1, y: 50, anchor: 'start' },
  right: { x: 59, y: 50, anchor: 'end' },
};

export function ButtonChordGlyph({
  filled = [],
  size = 60,
  className,
  style,
  strokeColor = 'var(--color-text-secondary)',
  fillColor = 'var(--color-text-secondary)',
  nodeLabels,
  ariaLabel = 'Button chord graphic',
}: Props) {
  const filledSet = new Set(filled);
  const height = (size * 52) / 60;
  const mergedClassName = ['button-chord-glyph', className].filter(Boolean).join(' ');

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 60 52"
      className={mergedClassName}
      style={style}
      role="img"
      aria-label={ariaLabel}
    >
      {(Object.keys(CIRCLE_LAYOUT) as ChordNode[]).map((node) => {
        const { cx, cy } = CIRCLE_LAYOUT[node];
        const active = filledSet.has(node);
        return (
          <circle
            key={node}
            cx={cx}
            cy={cy}
            r="10"
            fill={active ? fillColor : 'none'}
            stroke={strokeColor}
            strokeWidth="2"
          />
        );
      })}

      {nodeLabels && (Object.keys(nodeLabels) as ChordNode[]).map((node) => {
        const label = nodeLabels[node];
        if (!label) return null;
        const { x, y, anchor } = LABEL_LAYOUT[node];
        return (
          <text
            key={`label-${node}`}
            x={x}
            y={y}
            textAnchor={anchor}
            fontSize="7"
            fill={strokeColor}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
