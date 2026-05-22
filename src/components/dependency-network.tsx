'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Project, CATEGORY_COLORS } from '@/lib/types';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Share2 } from 'lucide-react';

interface DependencyNetworkProps {
  projects: Project[];
  onProjectClick?: (project: Project) => void;
}

interface Connection {
  source: number;
  target: number;
  sharedDeps: string[];
  count: number;
}

interface ArcData {
  index: number;
  project: Project;
  startAngle: number;
  endAngle: number;
  color: string;
}

export function DependencyNetwork({ projects, onProjectClick }: DependencyNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [threshold, setThreshold] = useState(2);
  const [hoveredArc, setHoveredArc] = useState<number | null>(null);
  const [hoveredRibbon, setHoveredRibbon] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Filter projects that have dependencies
  const projectsWithDeps = useMemo(() => {
    return projects.filter(p => {
      const allDeps = [...(p.dependencies?.runtime || []), ...(p.dependencies?.dev || [])];
      return allDeps.length > 0;
    });
  }, [projects]);

  // Compute connections between project pairs
  const connections = useMemo(() => {
    const conns: Connection[] = [];
    for (let i = 0; i < projectsWithDeps.length; i++) {
      const pA = projectsWithDeps[i];
      const depsA = [...(pA.dependencies?.runtime || []), ...(pA.dependencies?.dev || [])];
      for (let j = i + 1; j < projectsWithDeps.length; j++) {
        const pB = projectsWithDeps[j];
        const depsB = [...(pB.dependencies?.runtime || []), ...(pB.dependencies?.dev || [])];
        const shared = depsA.filter(d => depsB.includes(d));
        if (shared.length > 0) {
          conns.push({
            source: i,
            target: j,
            sharedDeps: shared,
            count: shared.length,
          });
        }
      }
    }
    return conns;
  }, [projectsWithDeps]);

  // Filter connections by threshold
  const filteredConnections = useMemo(() => {
    return connections.filter(c => c.count >= threshold);
  }, [connections, threshold]);

  // Get connected project indices
  const connectedIndices = useMemo(() => {
    const indices = new Set<number>();
    filteredConnections.forEach(c => {
      indices.add(c.source);
      indices.add(c.target);
    });
    return indices;
  }, [filteredConnections]);

  // Only show projects that have connections above threshold
  const activeProjects = useMemo(() => {
    return projectsWithDeps.filter((_, i) => connectedIndices.has(i));
  }, [projectsWithDeps, connectedIndices]);

  // Remap connection indices to active project indices
  const activeConnections = useMemo(() => {
    const oldToNew = new Map<number, number>();
    projectsWithDeps.forEach((_, i) => {
      if (connectedIndices.has(i)) {
        oldToNew.set(i, oldToNew.size);
      }
    });
    return filteredConnections.map(c => ({
      ...c,
      source: oldToNew.get(c.source)!,
      target: oldToNew.get(c.target)!,
    }));
  }, [projectsWithDeps, filteredConnections, connectedIndices]);

  // Compute total connection count
  const totalConnections = activeConnections.length;
  const totalProjects = activeProjects.length;

  // Chart geometry
  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;
  const outerRadius = Math.min(dimensions.width, dimensions.height) * 0.38;
  const arcGap = activeProjects.length > 1 ? 0.02 : 0;

  // Compute arc data for each project
  const arcs: ArcData[] = useMemo(() => {
    if (activeProjects.length === 0) return [];

    // Compute total "weight" (connection count per project for sizing)
    const weights = activeProjects.map((_, i) => {
      const connsForProject = activeConnections.filter(c => c.source === i || c.target === i);
      return Math.max(connsForProject.reduce((sum, c) => sum + c.count, 0), 1);
    });
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const totalGap = arcGap * activeProjects.length;
    const availableAngle = Math.PI * 2 - totalGap;

    let currentAngle = -Math.PI / 2;
    return activeProjects.map((p, i) => {
      const angle = (weights[i] / totalWeight) * availableAngle;
      const catColor = p.category ? CATEGORY_COLORS[p.category] : '#64748b';
      const arc: ArcData = {
        index: i,
        project: p,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        color: catColor,
      };
      currentAngle += angle + arcGap;
      return arc;
    });
  }, [activeProjects, activeConnections, arcGap]);

  // SVG path for an arc
  const describeArc = useCallback((startAngle: number, endAngle: number, radius: number): string => {
    const startX = cx + radius * Math.cos(startAngle);
    const startY = cy + radius * Math.sin(startAngle);
    const endX = cx + radius * Math.cos(endAngle);
    const endY = cy + radius * Math.sin(endAngle);
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  }, [cx, cy]);

  // SVG path for a ribbon (quadratic bezier)
  const describeRibbon = useCallback((arcA: ArcData, arcB: ArcData): string => {
    const midAngleA = (arcA.startAngle + arcA.endAngle) / 2;
    const midAngleB = (arcB.startAngle + arcB.endAngle) / 2;

    const startR = outerRadius - 2;
    const endR = outerRadius - 2;

    const x1 = cx + startR * Math.cos(midAngleA);
    const y1 = cy + startR * Math.sin(midAngleA);
    const x2 = cx + endR * Math.cos(midAngleB);
    const y2 = cy + endR * Math.sin(midAngleB);

    // Control point at center for a smooth curve
    const cpx = cx;
    const cpy = cy;

    return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
  }, [cx, cy, outerRadius]);

  // Max shared dep count for ribbon thickness
  const maxSharedCount = useMemo(() => {
    return Math.max(...activeConnections.map(c => c.count), 1);
  }, [activeConnections]);

  // Zoom controls
  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z * 1.2, 3)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z / 1.2, 0.3)), []);
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  // Category legend
  const categorySet = useMemo(() => {
    const cats = new Map<string, { color: string; count: number }>();
    activeProjects.forEach(p => {
      const cat = p.category || 'uncategorized';
      const color = p.category ? CATEGORY_COLORS[p.category] : '#64748b';
      cats.set(cat, { color, count: (cats.get(cat)?.count || 0) + 1 });
    });
    return [...cats.entries()];
  }, [activeProjects]);

  // If no data
  if (activeProjects.length < 2) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Share2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/50 font-medium">Not enough dependency data</p>
          <p className="text-xs text-muted-foreground/30 mt-1">
            Need at least 2 projects with shared dependencies to build the network.
            <br />Deep analyze your repos to discover connections.
          </p>
          {projectsWithDeps.length > 0 && (
            <p className="text-xs text-emerald-400/40 mt-2">
              {projectsWithDeps.length} projects have dependencies, but none share {threshold}+ deps.
              <br />
              Try lowering the threshold.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" ref={containerRef}>
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/15 bg-card/20 shrink-0">
        <div className="flex items-center gap-4">
          {/* Threshold slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Min shared deps</span>
            <Slider
              value={[threshold]}
              onValueChange={([v]) => setThreshold(v)}
              min={1}
              max={Math.max(maxSharedCount, 5)}
              step={1}
              className="w-24"
            />
            <span className="text-xs text-emerald-400/60 font-mono w-4 text-center">{threshold}</span>
          </div>

          {/* Connection count */}
          <span className="text-[10px] text-muted-foreground/40">
            {totalConnections} connection{totalConnections !== 1 ? 's' : ''} across {totalProjects} project{totalProjects !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button onClick={handleZoomOut} className="p-1 rounded hover:bg-card/40 text-muted-foreground/40 hover:text-foreground/60 transition-colors" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground/40 w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1 rounded hover:bg-card/40 text-muted-foreground/40 hover:text-foreground/60 transition-colors" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleResetView} className="p-1 rounded hover:bg-card/40 text-muted-foreground/40 hover:text-foreground/60 transition-colors" title="Reset view">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG container */}
      <div
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="w-full h-full"
        >
          <defs>
            {/* Glow filter for arcs */}
            <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Subtle glow for ribbons */}
            <filter id="ribbon-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Gradient definitions for each ribbon */}
            {activeConnections.map((conn, idx) => {
              const arcA = arcs[conn.source];
              const arcB = arcs[conn.target];
              if (!arcA || !arcB) return null;
              return (
                <linearGradient key={`grad-${idx}`} id={`ribbon-grad-${idx}`} gradientUnits="userSpaceOnUse" x1={cx + outerRadius * Math.cos((arcA.startAngle + arcA.endAngle) / 2)} y1={cy + outerRadius * Math.sin((arcA.startAngle + arcA.endAngle) / 2)} x2={cx + outerRadius * Math.cos((arcB.startAngle + arcB.endAngle) / 2)} y2={cy + outerRadius * Math.sin((arcB.startAngle + arcB.endAngle) / 2)}>
                  <stop offset="0%" stopColor={arcA.color} stopOpacity="0.6" />
                  <stop offset="100%" stopColor={arcB.color} stopOpacity="0.6" />
                </linearGradient>
              );
            })}
          </defs>

          {/* Transform group for zoom/pan */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ transformOrigin: `${cx}px ${cy}px` }}>

            {/* Background circle guide */}
            <circle cx={cx} cy={cy} r={outerRadius + 20} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={outerRadius * 0.5} fill="none" stroke="rgba(255,255,255,0.015)" strokeWidth="0.5" strokeDasharray="4 4" />

            {/* Center label */}
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              className="fill-foreground/30 text-[11px] font-semibold"
            >
              {totalConnections} connections
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              className="fill-foreground/20 text-[9px]"
            >
              across {totalProjects} projects
            </text>

            {/* Ribbons */}
            {activeConnections.map((conn, idx) => {
              const arcA = arcs[conn.source];
              const arcB = arcs[conn.target];
              if (!arcA || !arcB) return null;

              const path = describeRibbon(arcA, arcB);
              const thickness = Math.max(1, (conn.count / maxSharedCount) * 6);

              const isHoveredArc = hoveredArc !== null && (conn.source === hoveredArc || conn.target === hoveredArc);
              const isHovered = hoveredRibbon === idx;
              const isDimmed = hoveredArc !== null && !isHoveredArc;

              return (
                <motion.path
                  key={`ribbon-${idx}`}
                  d={path}
                  fill="none"
                  stroke={`url(#ribbon-grad-${idx})`}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  opacity={isDimmed ? 0.05 : isHovered || isHoveredArc ? 0.8 : 0.3}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: isDimmed ? 0.05 : isHovered || isHoveredArc ? 0.8 : 0.3 }}
                  transition={{ duration: 0.8, delay: idx * 0.03, ease: 'easeInOut' }}
                  style={{ cursor: 'pointer' }}
                  filter={isHovered || isHoveredArc ? 'url(#ribbon-glow)' : undefined}
                  onMouseEnter={(e) => {
                    setHoveredRibbon(idx);
                    const svgRect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
                    if (svgRect) {
                      setTooltip({
                        x: e.clientX - svgRect.left,
                        y: e.clientY - svgRect.top,
                        content: `${arcA.project.name} ↔ ${arcB.project.name}: ${conn.sharedDeps.length} shared deps\n${conn.sharedDeps.slice(0, 8).join(', ')}${conn.sharedDeps.length > 8 ? '...' : ''}`,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredRibbon(null);
                    setTooltip(null);
                  }}
                />
              );
            })}

            {/* Project arcs */}
            {arcs.map((arc, i) => {
              const path = describeArc(arc.startAngle, arc.endAngle, outerRadius);
              const innerPath = describeArc(arc.startAngle, arc.endAngle, outerRadius - 8);

              const isHovered = hoveredArc === i;
              const isDimmed = hoveredArc !== null && !isHovered;

              // Mid angle for label
              const midAngle = (arc.startAngle + arc.endAngle) / 2;
              const labelR = outerRadius + 16;
              const labelX = cx + labelR * Math.cos(midAngle);
              const labelY = cy + labelR * Math.sin(midAngle);

              return (
                <g key={`arc-${i}`}>
                  {/* Arc glow background */}
                  <motion.path
                    d={path}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={isHovered ? 14 : 10}
                    strokeLinecap="round"
                    opacity={0}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isDimmed ? 0.03 : isHovered ? 0.3 : 0.15 }}
                    transition={{ duration: 0.2 }}
                    filter="url(#arc-glow)"
                  />

                  {/* Inner arc (thinner, brighter) */}
                  <motion.path
                    d={innerPath}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    opacity={0}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isDimmed ? 0.05 : isHovered ? 1 : 0.7 }}
                    transition={{ duration: 0.2 }}
                  />

                  {/* Main arc */}
                  <motion.path
                    d={path}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={isHovered ? 10 : 7}
                    strokeLinecap="round"
                    opacity={0}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isDimmed ? 0.1 : isHovered ? 1 : 0.6 }}
                    transition={{ duration: 0.3, delay: i * 0.02 }}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredArc(i)}
                    onMouseLeave={() => setHoveredArc(null)}
                    onClick={() => onProjectClick?.(arc.project)}
                  />

                  {/* Project label */}
                  {(isHovered || (arc.endAngle - arc.startAngle) > 0.12) && (
                    <motion.text
                      x={labelX}
                      y={labelY}
                      textAnchor={midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'end' : midAngle === Math.PI / 2 || midAngle === Math.PI * 1.5 ? 'middle' : 'start'}
                      dominantBaseline="central"
                      className="fill-foreground/50 text-[8px] font-medium select-none"
                      style={{
                        opacity: isDimmed ? 0.05 : isHovered ? 1 : 0.5,
                        transform: `rotate(${midAngle * 180 / Math.PI + (midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 180 : 0)}, ${labelX}, ${labelY})`,
                      }}
                    >
                      {arc.project.name}
                    </motion.text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 px-3 py-2 bg-card/95 backdrop-blur-md border border-border/30 rounded-lg shadow-xl pointer-events-none max-w-xs"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 12,
            }}
          >
            <p className="text-[10px] font-semibold text-foreground/80 whitespace-pre-line">
              {tooltip.content.split('\n')[0]}
            </p>
            {tooltip.content.split('\n')[1] && (
              <p className="text-[9px] text-muted-foreground/50 mt-1 leading-tight">
                {tooltip.content.split('\n')[1]}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border/15 bg-card/20 shrink-0">
        <div className="flex items-center gap-2">
          {categorySet.map(([cat, { color, count }]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-muted-foreground/50">{cat} ({count})</span>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 text-[9px] text-muted-foreground/30">
          <span>Thickness = shared deps</span>
          <span>Click arc to open detail</span>
          <span>Scroll to zoom, drag to pan</span>
        </div>
      </div>
    </div>
  );
}
