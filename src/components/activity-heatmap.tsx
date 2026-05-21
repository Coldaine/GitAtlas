'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCommit, Flame } from 'lucide-react';

interface ActivityDay {
  date: string;
  count: number;
  repos: string[];
}

interface HeatmapData {
  activity: ActivityDay[];
  totalCommits: number;
  activeDays: number;
}

interface CellData {
  date: string;
  count: number;
  repos: string[];
  week: number;
  day: number;
}

const CELL_SIZE = 7;
const CELL_GAP = 1;
const CELL_STEP = CELL_SIZE + CELL_GAP;

// Emerald color palette based on commit count - more visible
function getColor(count: number): string {
  if (count === 0) return 'rgba(16, 185, 129, 0.12)';
  if (count <= 2) return 'rgba(16, 185, 129, 0.35)';
  if (count <= 5) return 'rgba(16, 185, 129, 0.55)';
  if (count <= 9) return 'rgba(16, 185, 129, 0.75)';
  return 'rgba(16, 185, 129, 0.95)';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ActivityHeatmap({ username }: { username: string }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/github/commit-activity?username=${username}`);
        if (!res.ok) throw new Error('Failed to fetch commit activity');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [username]);

  // Build grid data: 52 weeks x 7 days
  const grid = useMemo(() => {
    if (!data) return { cells: [], weeks: 0, monthLabels: [] as { label: string; x: number }[] };

    const now = new Date();
    const cells: CellData[][] = []; // cells[week][day]
    const activityMap = new Map<string, ActivityDay>();
    data.activity.forEach(d => activityMap.set(d.date, d));

    // Find the most recent Sunday
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - endDate.getDay()); // go back to Sunday

    const monthLabels: { label: string; x: number }[] = [];
    let lastMonth = -1;

    for (let w = 51; w >= 0; w--) {
      const weekCells: CellData[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(endDate);
        cellDate.setDate(cellDate.getDate() - (51 - w) * 7 - (6 - d));
        const dateStr = cellDate.toISOString().slice(0, 10);
        const act = activityMap.get(dateStr);
        weekCells.push({
          date: dateStr,
          count: act?.count || 0,
          repos: act?.repos || [],
          week: 51 - w,
          day: d,
        });

        // Track month labels
        if (d === 0) {
          const month = cellDate.getMonth();
          if (month !== lastMonth) {
            monthLabels.push({ label: MONTHS[month], x: (51 - w) * CELL_STEP });
            lastMonth = month;
          }
        }
      }
      cells.push(weekCells);
    }

    return { cells, weeks: 52, monthLabels };
  }, [data]);

  // Compute streak — longest consecutive days with commits
  const streak = useMemo(() => {
    if (!data || data.activity.length === 0) return { current: 0, longest: 0 };

    const activeDates = new Set(data.activity.filter(d => d.count > 0).map(d => d.date));
    const sortedDates = [...activeDates].sort();

    if (sortedDates.length === 0) return { current: 0, longest: 0 };

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    // Calculate current streak (from today backwards)
    let currentActiveStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().slice(0, 10);
      if (activeDates.has(dateStr)) {
        currentActiveStreak++;
      } else {
        break;
      }
    }

    return { current: currentActiveStreak, longest: Math.max(longestStreak, currentActiveStreak) };
  }, [data]);

  const handleCellHover = useCallback((cell: CellData, e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgParent = e.currentTarget.closest('svg')?.getBoundingClientRect();
    if (svgParent) {
      setTooltipPos({
        x: rect.left - svgParent.left + rect.width / 2,
        y: rect.top - svgParent.top - 4,
      });
    }
    setHoveredCell(cell);
  }, []);

  const handleCellLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 52 }).map((_, w) => (
            <div key={w} className="flex flex-col gap-0.5">
              {Array.from({ length: 7 }).map((_, d) => (
                <Skeleton key={d} className="w-2.5 h-2.5 rounded-sm" />
              ))}
            </div>
          ))}
        </div>
        <Skeleton className="h-2 w-24" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-[10px] text-muted-foreground/50 py-2">
        Could not load commit activity
      </div>
    );
  }

  if (!data) return null;

  const svgWidth = 52 * CELL_STEP + 20; // extra for day labels
  const svgHeight = 7 * CELL_STEP + 14; // extra for month labels

  // Tooltip dimensions - larger to show project names
  const tooltipWidth = hoveredCell && hoveredCell.repos.length > 0 ? 160 : 120;
  const tooltipHeight = hoveredCell && hoveredCell.repos.length > 0 ? 44 + Math.min(hoveredCell.repos.length, 4) * 12 : 44;

  return (
    <div className="space-y-1.5">
      {/* Summary with commit icon + streak */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 flex-wrap">
        <GitCommit className="w-3 h-3 text-emerald-400/70" />
        <span className="text-emerald-400/70 font-medium">{data.totalCommits}</span> commits in the last year ·{' '}
        <span className="text-emerald-400/70 font-medium">{data.activeDays}</span> active days
        {streak.longest > 0 && (
          <>
            <span className="text-muted-foreground/20">·</span>
            <Flame className="w-3 h-3 text-amber-400/70" />
            <span className="text-amber-400/70 font-medium">{streak.longest}</span> day longest streak
            {streak.current > 1 && (
              <span className="text-amber-400/50">({streak.current} current)</span>
            )}
          </>
        )}
      </div>

      {/* Heatmap SVG with border */}
      <div className="overflow-x-auto rounded-md border border-emerald-500/10 p-1">
        <svg width={svgWidth} height={svgHeight} className="block">
          {/* Month labels — more prominent */}
          {grid.monthLabels.map((ml, i) => (
            <text
              key={i}
              x={ml.x + 18}
              y={8}
              className="fill-muted-foreground/40"
              fontSize={7}
              fontWeight="500"
            >
              {ml.label}
            </text>
          ))}

          {/* Day labels */}
          {[1, 3, 5].map(d => (
            <text
              key={d}
              x={0}
              y={12 + d * CELL_STEP + CELL_SIZE / 2 + 1}
              className="fill-muted-foreground/25"
              fontSize={6}
              dominantBaseline="middle"
            >
              {DAYS[d]}
            </text>
          ))}

          {/* Grid cells */}
          {grid.cells.map((week, wi) =>
            week.map((cell, di) => (
              <rect
                key={`${wi}-${di}`}
                x={18 + (51 - wi) * CELL_STEP}
                y={12 + di * CELL_STEP}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                fill={getColor(cell.count)}
                stroke={cell.count === 0 ? 'rgba(16,185,129,0.06)' : 'none'}
                strokeWidth={cell.count === 0 ? 0.5 : 0}
                className="transition-colors duration-100 cursor-pointer"
                onMouseEnter={(e) => handleCellHover(cell, e)}
                onMouseLeave={handleCellLeave}
              />
            ))
          )}

          {/* Tooltip — improved with project names */}
          {hoveredCell && (
            <g>
              <rect
                x={tooltipPos.x - tooltipWidth / 2}
                y={tooltipPos.y - tooltipHeight - 4}
                width={tooltipWidth}
                height={tooltipHeight}
                rx={6}
                fill="rgba(10, 10, 10, 0.95)"
                stroke="rgba(16,185,129,0.15)"
                strokeWidth={0.5}
              />
              {/* Date */}
              <text
                x={tooltipPos.x}
                y={tooltipPos.y - tooltipHeight + 10}
                textAnchor="middle"
                className="fill-foreground/80 text-[9px]"
                fontSize={9}
                fontWeight="600"
              >
                {hoveredCell.date}
              </text>
              {/* Commit count */}
              <text
                x={tooltipPos.x}
                y={tooltipPos.y - tooltipHeight + 22}
                textAnchor="middle"
                className="fill-emerald-400/80 text-[9px]"
                fontSize={9}
              >
                {hoveredCell.count === 0
                  ? 'No commits'
                  : `${hoveredCell.count} commit${hoveredCell.count > 1 ? 's' : ''}`}
              </text>
              {/* Project names that contributed */}
              {hoveredCell.repos.length > 0 && (
                <>
                  {hoveredCell.repos.slice(0, 4).map((repo, ri) => (
                    <text
                      key={ri}
                      x={tooltipPos.x}
                      y={tooltipPos.y - tooltipHeight + 34 + ri * 12}
                      textAnchor="middle"
                      className="fill-muted-foreground/50 text-[7px]"
                      fontSize={7}
                    >
                      {repo.length > 18 ? repo.slice(0, 16) + '…' : repo}
                    </text>
                  ))}
                  {hoveredCell.repos.length > 4 && (
                    <text
                      x={tooltipPos.x}
                      y={tooltipPos.y - tooltipHeight + 34 + 4 * 12}
                      textAnchor="middle"
                      className="fill-muted-foreground/30 text-[7px]"
                      fontSize={7}
                    >
                      +{hoveredCell.repos.length - 4} more
                    </text>
                  )}
                </>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-1 text-[8px] text-muted-foreground/30">
        <span>Less</span>
        {[0, 2, 5, 9, 15].map((count, i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-sm inline-block"
            style={{ backgroundColor: getColor(count) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
