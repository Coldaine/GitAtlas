'use client';

import { Project, CATEGORY_COLORS } from '@/lib/types';
import { useAtlasStore } from '@/lib/store';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Clock, Star, GitFork, Flame, Package } from 'lucide-react';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';

interface TimelineViewProps {
  projects: Project[];
}

interface HoverCardData {
  project: Project;
  x: number;
  y: number;
}

export function TimelineView({ projects }: TimelineViewProps) {
  const { setSelectedProject } = useAtlasStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [hoverCard, setHoverCard] = useState<HoverCardData | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Smooth scroll animation on load
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Animate scroll to "today" position
    const timer = setTimeout(() => {
      const todayLine = el.querySelector('.today-marker-line');
      if (todayLine) {
        todayLine.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [projects]);

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
    const markers: { x: number; label: string; month: string }[] = [];
    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      markers.push({
        x: timeToX(current.getTime()),
        label: format(current, 'MMM yyyy'),
        month: format(current, 'MMM'),
      });
      current.setMonth(current.getMonth() + 1);
    }
    return markers.filter((m, i) => i % Math.max(1, Math.floor(markers.length / 10)) === 0);
  }, [timeRange, rangeMs, chartWidth]);

  // Current date line
  const nowX = timeToX(Date.now());

  // Category count for y-axis badges
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => {
      if (i.category) map.set(i.category, (map.get(i.category) || 0) + 1);
    });
    return map;
  }, [items]);

  // Dependency connection lines between projects sharing deps
  const connectionLines = useMemo(() => {
    const lines: { fromIdx: number; toIdx: number; color: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].project;
        const b = items[j].project;
        if (a.dependencies && b.dependencies) {
          const aAll = [...(a.dependencies.runtime || []), ...(a.dependencies.dev || [])];
          const bAll = [...(b.dependencies.runtime || []), ...(b.dependencies.dev || [])];
          const shared = aAll.filter(d => bAll.includes(d));
          if (shared.length >= 3) {
            lines.push({
              fromIdx: i,
              toIdx: j,
              color: 'rgba(59,130,246,0.15)',
            });
          }
        }
      }
    }
    return lines;
  }, [items]);

  // Hover card handler
  const handleBarHover = useCallback((item: typeof items[0], idx: number, e: React.MouseEvent) => {
    setHoveredProject(item.id);
    const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
    if (rect) {
      setHoverCard({
        project: item.project,
        x: Math.min(rect.width - 200, timeToX(item.start)),
        y: barStartY + idx * (barHeight + barGap) - 8,
      });
    }
  }, [timeToX, barStartY]);

  const handleBarLeave = useCallback(() => {
    setHoveredProject(null);
    setHoverCard(null);
  }, []);

  // Days since push for activity indicator
  const getDaysSincePush = (p: Project) => {
    if (!p.pushedAt) return 999;
    return (Date.now() - new Date(p.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
  };

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No projects to display on timeline
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      <div ref={scrollContainerRef} className="w-full h-full overflow-x-auto custom-scrollbar">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
        >
          <defs>
            <filter id="barShadow">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.2)" />
            </filter>
            <filter id="hoverGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect width="100%" height="100%" fill="transparent" />

          {/* Month grid lines — more prominent */}
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
                fill="rgba(148,163,184,0.4)"
                fontSize={9}
                fontWeight="500"
              >
                {m.label}
              </text>
            </g>
          ))}

          {/* Current date line — pulsing "Today" marker */}
          <line
            className="today-marker-line"
            x1={nowX}
            y1={topMargin - 5}
            x2={nowX}
            y2={dimensions.height - bottomMargin}
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.6}
          />
          {/* Pulsing dot at top of today line */}
          <circle
            cx={nowX}
            cy={topMargin - 8}
            r={3}
            fill="#10b981"
            className="today-pulse"
            opacity={0.8}
          />
          <text
            x={nowX}
            y={topMargin - 18}
            textAnchor="middle"
            fill="#10b981"
            fontSize={9}
            fontWeight="600"
          >
            Today
          </text>

          {/* Dependency connection lines between projects */}
          {connectionLines.map((line, i) => {
            const fromY = barStartY + line.fromIdx * (barHeight + barGap) + barHeight / 2;
            const toY = barStartY + line.toIdx * (barHeight + barGap) + barHeight / 2;
            const fromX = timeToX(items[line.fromIdx].start) + 20;
            const toX = timeToX(items[line.toIdx].start) + 20;
            return (
              <path
                key={`conn-${i}`}
                d={`M ${fromX} ${fromY} C ${fromX + 40} ${fromY}, ${toX - 40} ${toY}, ${toX} ${toY}`}
                fill="none"
                stroke={line.color}
                strokeWidth={1}
                strokeDasharray="3 3"
                className="pointer-events-none"
              />
            );
          })}

          {/* Project bars */}
          {items.map((item, i) => {
            const x1 = timeToX(item.start);
            const x2 = timeToX(item.end);
            const y = barStartY + i * (barHeight + barGap);
            const width = Math.max(x2 - x1, 8);
            const isHovered = hoveredProject === item.id;
            const daysSince = getDaysSincePush(item.project);
            const activityColor = daysSince < 7 ? '#ef4444' : daysSince < 30 ? '#f59e0b' : daysSince < 180 ? '#10b981' : '#64748b';

            return (
              <g
                key={item.id}
                onMouseEnter={(e) => handleBarHover(item, i, e)}
                onMouseLeave={handleBarLeave}
                onClick={() => setSelectedProject(item.project)}
                style={{ cursor: 'pointer' }}
              >
                {/* Label — with category count badge */}
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

                {/* Activity status dot on y-axis */}
                <circle
                  cx={leftMargin - 12 - (item.name.length > 16 ? 84 : item.name.length * 5.5)}
                  cy={y + barHeight / 2}
                  r={2}
                  fill={activityColor}
                  opacity={isHovered ? 0.8 : 0.4}
                  className="pointer-events-none"
                />

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
                  filter={isHovered ? 'url(#hoverGlow)' : undefined}
                  style={{ transition: 'opacity 0.2s, filter 0.2s' }}
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
      </div>

      {/* Hover card */}
      {hoverCard && hoveredProject && (
        <div
          className="absolute hover-card-tooltip p-3 z-20 pointer-events-none min-w-[200px]"
          style={{
            left: `${hoverCard.x}px`,
            top: `${hoverCard.y - 160}px`,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: hoverCard.project.category ? CATEGORY_COLORS[hoverCard.project.category] : '#64748b', opacity: 0.7 }}
            />
            <span className="text-xs font-semibold text-foreground/90 truncate">{hoverCard.project.name}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mb-2 line-clamp-2 leading-relaxed">
            {hoverCard.project.deepSummary?.slice(0, 100) || hoverCard.project.summary?.slice(0, 100) || hoverCard.project.description || 'No description'}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400/60" /> {hoverCard.project.stargazersCount}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="w-3 h-3" /> {hoverCard.project.forksCount}
            </span>
            {hoverCard.project.language && (
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" /> {hoverCard.project.language}
              </span>
            )}
          </div>
          {hoverCard.project.pushedAt && (
            <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground/40">
              <Flame className="w-2.5 h-2.5" />
              Last push {format(hoverCard.project.pushedAt, 'MMM d, yyyy')}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 right-4 flex items-center gap-3 text-[9px] text-muted-foreground/40">
        {Object.entries(CATEGORY_COLORS)
          .filter(([cat]) => items.some(i => i.category === cat))
          .map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: 0.6 }} />
              {cat}
              {categoryCounts.get(cat) && (
                <span className="text-muted-foreground/25">({categoryCounts.get(cat)})</span>
              )}
            </span>
          ))}
        {/* Dependency connection legend */}
        {connectionLines.length > 0 && (
          <span className="flex items-center gap-1 ml-2">
            <span className="w-4 h-0 border-t border-dashed border-blue-400/30" />
            shared deps
          </span>
        )}
      </div>
    </div>
  );
}
