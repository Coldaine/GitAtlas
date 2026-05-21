'use client';

import { Project, CATEGORY_COLORS } from '@/lib/types';
import { useAtlasStore } from '@/lib/store';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Clock, Star } from 'lucide-react';
import { useMemo, useState, useRef, useEffect } from 'react';

interface TimelineViewProps {
  projects: Project[];
}

export function TimelineView({ projects }: TimelineViewProps) {
  const { setSelectedProject } = useAtlasStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.max(600, width), height: Math.max(300, height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute timeline data
  const timelineData = useMemo(() => {
    if (projects.length === 0) return { items: [], timeRange: { start: 0, end: 0 } };

    const now = Date.now();
    const items = projects
      .filter(p => p.githubCreatedAt)
      .map(p => {
        const start = new Date(p.githubCreatedAt).getTime();
        const end = p.pushedAt ? new Date(p.pushedAt).getTime() : start + 30 * 24 * 60 * 60 * 1000;
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          start,
          end: Math.min(end, now),
          color: p.category ? CATEGORY_COLORS[p.category] : '#64748b',
          stars: p.stargazersCount,
          language: p.language,
          project: p,
        };
      })
      .sort((a, b) => a.start - b.start);

    const allTimes = items.flatMap(i => [i.start, i.end]);
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes, now);
    const padding = (maxTime - minTime) * 0.05;

    return {
      items,
      timeRange: {
        start: minTime - padding,
        end: maxTime + padding,
      },
    };
  }, [projects]);

  const { items, timeRange } = timelineData;
  const rangeMs = timeRange.end - timeRange.start;

  // Layout constants
  const leftMargin = 140;
  const rightMargin = 30;
  const topMargin = 40;
  const bottomMargin = 30;
  const barHeight = 22;
  const barGap = 6;
  const chartWidth = dimensions.width - leftMargin - rightMargin;
  const chartHeight = dimensions.height - topMargin - bottomMargin;
  const totalBarArea = items.length * (barHeight + barGap);
  const barStartY = Math.max(topMargin, topMargin + (chartHeight - totalBarArea) / 2);

  // Time to X position
  const timeToX = (ts: number) =>
    leftMargin + ((ts - timeRange.start) / rangeMs) * chartWidth;

  // Generate month markers
  const monthMarkers = useMemo(() => {
    if (rangeMs === 0) return [];
    const markers: { x: number; label: string } = [];
    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      markers.push({
        x: timeToX(current.getTime()),
        label: format(current, 'MMM yyyy'),
      });
      current.setMonth(current.getMonth() + 1);
    }
    return markers.filter((m, i) => i % Math.max(1, Math.floor(markers.length / 10)) === 0);
  }, [timeRange, rangeMs, chartWidth]);

  // Current date line
  const nowX = timeToX(Date.now());

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No projects to display on timeline
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      >
        <defs>
          <filter id="barShadow">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.2)" />
          </filter>
        </defs>

        {/* Background */}
        <rect width="100%" height="100%" fill="transparent" />

        {/* Month grid lines */}
        {monthMarkers.map((m, i) => (
          <g key={i}>
            <line
              x1={m.x}
              y1={topMargin - 5}
              x2={m.x}
              y2={dimensions.height - bottomMargin}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
            <text
              x={m.x}
              y={topMargin - 10}
              textAnchor="middle"
              fill="rgba(148,163,184,0.3)"
              fontSize={9}
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Current date line */}
        <line
          x1={nowX}
          y1={topMargin - 5}
          x2={nowX}
          y2={dimensions.height - bottomMargin}
          stroke="#10b981"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.5}
        />
        <text
          x={nowX}
          y={topMargin - 15}
          textAnchor="middle"
          fill="#10b981"
          fontSize={9}
          fontWeight="500"
        >
          Today
        </text>

        {/* Project bars */}
        {items.map((item, i) => {
          const x1 = timeToX(item.start);
          const x2 = timeToX(item.end);
          const y = barStartY + i * (barHeight + barGap);
          const width = Math.max(x2 - x1, 8);
          const isHovered = hoveredProject === item.id;

          return (
            <g
              key={item.id}
              onMouseEnter={() => setHoveredProject(item.id)}
              onMouseLeave={() => setHoveredProject(null)}
              onClick={() => setSelectedProject(item.project)}
              style={{ cursor: 'pointer' }}
            >
              {/* Label */}
              <text
                x={leftMargin - 8}
                y={y + barHeight / 2 + 1}
                textAnchor="end"
                fill={isHovered ? 'rgba(226,232,240,0.9)' : 'rgba(148,163,184,0.5)'}
                fontSize={isHovered ? 10 : 9}
                fontWeight={isHovered ? '600' : '400'}
                className="pointer-events-none select-none truncate"
                style={{ fontFamily: 'var(--font-geist-sans)' }}
              >
                {item.name.length > 16 ? item.name.slice(0, 14) + '…' : item.name}
              </text>

              {/* Bar background track */}
              <rect
                x={x1}
                y={y}
                width={width}
                height={barHeight}
                rx={4}
                fill={item.color}
                opacity={isHovered ? 0.4 : 0.15}
              />

              {/* Bar fill */}
              <rect
                x={x1}
                y={y + 2}
                width={width}
                height={barHeight - 4}
                rx={3}
                fill={item.color}
                opacity={isHovered ? 0.85 : 0.55}
                filter={isHovered ? 'url(#barShadow)' : undefined}
              />

              {/* Star count on bar */}
              {item.stars > 0 && width > 50 && (
                <text
                  x={x1 + 8}
                  y={y + barHeight / 2 + 1}
                  fill="rgba(255,255,255,0.7)"
                  fontSize={8}
                  fontWeight="500"
                  className="pointer-events-none select-none"
                >
                  ★{item.stars}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 right-4 flex items-center gap-3 text-[9px] text-muted-foreground/40">
        {Object.entries(CATEGORY_COLORS)
          .filter(([cat]) => items.some(i => i.category === cat))
          .map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: 0.6 }} />
              {cat}
            </span>
          ))}
      </div>
    </div>
  );
}
