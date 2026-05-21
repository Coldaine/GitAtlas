'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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

// Emerald color palette based on commit count
function getColor(count: number): string {
  if (count === 0) return 'rgba(16, 185, 129, 0.06)';
  if (count <= 2) return 'rgba(16, 185, 129, 0.25)';
  if (count <= 5) return 'rgba(16, 185, 129, 0.45)';
  if (count <= 9) return 'rgba(16, 185, 129, 0.7)';
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

  return (
    <div className="space-y-1.5">
      {/* Summary */}
      <div className="text-[10px] text-muted-foreground/50">
        <span className="text-emerald-400/70 font-medium">{data.totalCommits}</span> commits in the last year ·{' '}
        <span className="text-emerald-400/70 font-medium">{data.activeDays}</span> active days
      </div>

      {/* Heatmap SVG */}
      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="block">
          {/* Month labels */}
          {grid.monthLabels.map((ml, i) => (
            <text
              key={i}
              x={ml.x + 18}
              y={8}
              className="fill-muted-foreground/30"
              fontSize={7}
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
                className="transition-colors duration-100 cursor-pointer"
                onMouseEnter={(e) => handleCellHover(cell, e)}
                onMouseLeave={handleCellLeave}
              />
            ))
          )}

          {/* Tooltip */}
          {hoveredCell && (
            <g>
              <rect
                x={tooltipPos.x - 60}
                y={tooltipPos.y - 52}
                width={120}
                height={44}
                rx={6}
                fill="rgba(10, 10, 10, 0.95)"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={0.5}
              />
              <text
                x={tooltipPos.x}
                y={tooltipPos.y - 38}
                textAnchor="middle"
                className="fill-foreground/80 text-[9px]"
                fontSize={9}
              >
                {hoveredCell.date}
              </text>
              <text
                x={tooltipPos.x}
                y={tooltipPos.y - 24}
                textAnchor="middle"
                className="fill-emerald-400/80 text-[9px]"
                fontSize={9}
              >
                {hoveredCell.count === 0
                  ? 'No commits'
                  : `${hoveredCell.count} commit${hoveredCell.count > 1 ? 's' : ''}`}
              </text>
              {hoveredCell.repos.length > 0 && (
                <text
                  x={tooltipPos.x}
                  y={tooltipPos.y - 12}
                  textAnchor="middle"
                  className="fill-muted-foreground/40 text-[7px]"
                  fontSize={7}
                >
                  {hoveredCell.repos.slice(0, 3).join(', ')}
                  {hoveredCell.repos.length > 3 ? ` +${hoveredCell.repos.length - 3}` : ''}
                </text>
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
