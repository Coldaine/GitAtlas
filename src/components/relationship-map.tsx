'use client';

import { Project, CATEGORY_COLORS } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface RelationshipMapProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
}

interface CircleNode {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  color: string;
  category: string;
  project?: Project;
  score: number;
  children?: CircleNode[];
}

interface Connection {
  from: CircleNode;
  to: CircleNode;
  type: 'tag' | 'dep';
  strength: number;
}

// Compute composite score for a project (stars + forks + activity)
function projectScore(p: Project): number {
  let score = p.stargazersCount * 2 + p.forksCount;
  if (p.pushedAt) {
    const daysSincePush = (Date.now() - new Date(p.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePush < 30) score += 20;
    else if (daysSincePush < 90) score += 10;
    else if (daysSincePush < 180) score += 5;
  }
  if (p.deepAnalyzedAt) score += 15;
  if (!p.isArchived) score += 5;
  return Math.max(score, 1);
}

// Compute connections between projects (shared tags, shared deps)
function computeConnections(projects: Project[]): Map<string, Map<string, { type: 'tag' | 'dep'; strength: number }>> {
  const connMap = new Map<string, Map<string, { type: 'tag' | 'dep'; strength: number }>>();

  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i];
      const b = projects[j];

      const aTags = new Set([...a.tags, ...a.topics]);
      const bTags = new Set([...b.tags, ...b.topics]);
      const sharedTags = [...aTags].filter(t => bTags.has(t)).length;

      let sharedDeps = 0;
      const aDeps = new Set([...(a.dependencies?.runtime || []), ...(a.dependencies?.dev || [])]);
      const bDeps = new Set([...(b.dependencies?.runtime || []), ...(b.dependencies?.dev || [])]);
      sharedDeps = [...aDeps].filter(d => bDeps.has(d)).length;

      const tagStrength = sharedTags;
      const depStrength = sharedDeps;
      const maxStrength = Math.max(tagStrength, depStrength);

      if (maxStrength >= 2) {
        if (!connMap.has(a.id)) connMap.set(a.id, new Map());
        if (!connMap.has(b.id)) connMap.set(b.id, new Map());
        const type = depStrength >= tagStrength ? 'dep' : 'tag';
        connMap.get(a.id)!.set(b.id, { type, strength: maxStrength });
        connMap.get(b.id)!.set(a.id, { type, strength: maxStrength });
      }
    }
  }

  return connMap;
}

export function RelationshipMap({ projects, onProjectClick }: RelationshipMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hoveredNode, setHoveredNode] = useState<CircleNode | null>(null);
  const [zoomedCategory, setZoomedCategory] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: CircleNode } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const [isPanningState, setIsPanningState] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build circle-packing layout — centered at (0,0)
  const { categoryNodes, allProjectNodes, connections } = useMemo(() => {
    const categories = new Map<string, Project[]>();
    projects.forEach(p => {
      const cat = p.category || 'other';
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(p);
    });

    const maxR = Math.min(size.w, size.h) * 0.38;

    const catEntries = [...categories.entries()].sort((a, b) => b[1].length - a[1].length);
    const catNodes: CircleNode[] = [];
    const projNodes: CircleNode[] = [];
    const conns: Connection[] = [];

    const connMap = computeConnections(projects);

    // Place categories in a circle around (0,0)
    catEntries.forEach(([cat, catProjects], idx) => {
      const angle = (idx / catEntries.length) * Math.PI * 2 - Math.PI / 2;
      const catDist = maxR * 0.5;
      const catX = Math.cos(angle) * catDist;
      const catY = Math.sin(angle) * catDist;

      const totalScore = catProjects.reduce((s, p) => s + projectScore(p), 0);
      const catRadius = Math.max(45, Math.min(110, 25 + catProjects.length * 14));

      const color = CATEGORY_COLORS[cat] || '#64748b';

      const catNode: CircleNode = {
        id: `cat-${cat}`,
        name: cat,
        x: catX,
        y: catY,
        r: catRadius,
        color,
        category: cat,
        score: totalScore,
        children: [],
      };

      // Place projects within category circle
      const sortedProjects = [...catProjects].sort((a, b) => projectScore(b) - projectScore(a));
      const maxProjectR = catRadius * 0.28;
      const minProjectR = catRadius * 0.1;

      sortedProjects.forEach((p, pi) => {
        const pScore = projectScore(p);
        const maxScore = projectScore(sortedProjects[0]);
        const ratio = maxScore > 0 ? pScore / maxScore : 0.5;
        const pR = minProjectR + ratio * (maxProjectR - minProjectR);

        let px: number;
        let py: number;
        if (pi === 0) {
          px = catX;
          py = catY;
        } else {
          const ring = Math.ceil(pi / 6);
          const posInRing = (pi - 1) % 6;
          const ringAngle = (posInRing / 6) * Math.PI * 2 + (ring * 0.5);
          const ringR = catRadius * 0.22 * ring;
          px = catX + Math.cos(ringAngle) * ringR;
          py = catY + Math.sin(ringAngle) * ringR;
        }

        const pNode: CircleNode = {
          id: p.id,
          name: p.name,
          x: px,
          y: py,
          r: pR,
          color,
          category: cat,
          project: p,
          score: pScore,
        };

        projNodes.push(pNode);
        catNode.children!.push(pNode);
      });

      catNodes.push(catNode);
    });

    // Compute connections between project nodes
    const nodeMap = new Map(projNodes.map(n => [n.id, n]));
    connMap.forEach((targets, sourceId) => {
      targets.forEach((info, targetId) => {
        const src = nodeMap.get(sourceId);
        const tgt = nodeMap.get(targetId);
        if (src && tgt) {
          conns.push({ from: src, to: tgt, type: info.type, strength: info.strength });
        }
      });
    });

    return { categoryNodes: catNodes, allProjectNodes: projNodes, connections: conns };
  }, [projects, size]);

  // Get connections for hovered node
  const hoveredConnections = useMemo(() => {
    if (!hoveredNode || !hoveredNode.project) return [];
    return connections.filter(c => c.from.id === hoveredNode.id || c.to.id === hoveredNode.id);
  }, [hoveredNode, connections]);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && (e.target as Element).closest('.relationship-bg')) {
      isPanning.current = true;
      setIsPanningState(true);
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setIsPanningState(false);
  }, []);

  // Category zoom
  const handleCategoryClick = useCallback((cat: string) => {
    setZoomedCategory(prev => prev === cat ? null : cat);
  }, []);

  // Find the center node for zooming into a category
  const zoomedCatNode = useMemo(() => {
    if (!zoomedCategory) return null;
    return categoryNodes.find(n => n.category === zoomedCategory);
  }, [zoomedCategory, categoryNodes]);

  // Calculate effective transform
  const effectiveTransform = useMemo(() => {
    const baseX = size.w / 2 + pan.x;
    const baseY = size.h / 2 + pan.y;
    if (zoomedCatNode) {
      const targetX = size.w / 2 - zoomedCatNode.x;
      const targetY = size.h / 2 - zoomedCatNode.y;
      const targetScale = Math.min(2.5, (Math.min(size.w, size.h) * 0.7) / (zoomedCatNode.r * 2));
      return { x: targetX, y: targetY, scale: targetScale };
    }
    return { x: baseX, y: baseY, scale: zoom };
  }, [zoomedCatNode, pan, zoom, size]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-background/50">
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button
          onClick={() => setZoom(z => Math.min(3, z * 1.2))}
          className="p-1.5 rounded-lg bg-card/60 backdrop-blur border border-border/20 text-muted-foreground/60 hover:text-foreground transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}
          className="p-1.5 rounded-lg bg-card/60 backdrop-blur border border-border/20 text-muted-foreground/60 hover:text-foreground transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setZoomedCategory(null); }}
          className="p-1.5 rounded-lg bg-card/60 backdrop-blur border border-border/20 text-muted-foreground/60 hover:text-foreground transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <span className="ml-1 text-[10px] text-muted-foreground/40">{Math.round(effectiveTransform.scale * 100)}%</span>
      </div>

      {/* Back button when zoomed */}
      <AnimatePresence>
        {zoomedCategory && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={() => setZoomedCategory(null)}
            className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/80 backdrop-blur border border-border/30 text-sm text-foreground/80 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </motion.button>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2 px-3 py-2 rounded-lg bg-card/60 backdrop-blur border border-border/20">
        {Object.entries(CATEGORY_COLORS)
          .filter(([cat]) => categoryNodes.some(n => n.category === cat))
          .map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
              <span className="text-muted-foreground/60">{cat}</span>
            </div>
          ))}
        <div className="ml-2 text-[9px] text-muted-foreground/30">Circle size = impact score</div>
      </div>

      {/* SVG */}
      <svg
        className="w-full h-full relationship-bg"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanningState ? 'grabbing' : 'grab' }}
      >
        <defs>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <radialGradient key={cat} id={`grad-${cat}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </radialGradient>
          ))}
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${effectiveTransform.x}, ${effectiveTransform.y}) scale(${effectiveTransform.scale})`}>
          {/* Center text */}
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground/10 select-none pointer-events-none"
            fontSize={40}
            fontWeight="bold"
          >
            {projects.length} Projects
          </text>

          {/* Connection lines */}
          {connections.map((conn, i) => {
            const isHoveredConn = hoveredNode && (conn.from.id === hoveredNode.id || conn.to.id === hoveredNode.id);
            const opacity = hoveredNode ? (isHoveredConn ? 0.6 : 0.03) : 0.08;

            return (
              <line
                key={`conn-${i}`}
                x1={conn.from.x}
                y1={conn.from.y}
                x2={conn.to.x}
                y2={conn.to.y}
                stroke={conn.type === 'dep' ? '#3b82f6' : conn.from.color}
                strokeWidth={Math.min(3, 0.5 + conn.strength * 0.3)}
                strokeOpacity={opacity}
                strokeDasharray={conn.type === 'dep' ? '4 2' : 'none'}
              />
            );
          })}

          {/* Highlighted connections for hovered node */}
          {hoveredNode && hoveredConnections.map((conn, i) => {
            const otherNode = conn.from.id === hoveredNode.id ? conn.to : conn.from;
            return (
              <motion.line
                key={`hconn-${i}`}
                x1={hoveredNode.x}
                y1={hoveredNode.y}
                x2={otherNode.x}
                y2={otherNode.y}
                stroke={conn.type === 'dep' ? '#3b82f6' : hoveredNode.color}
                strokeWidth={1 + conn.strength * 0.4}
                strokeOpacity={0.6}
                strokeDasharray={conn.type === 'dep' ? '4 2' : 'none'}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3 }}
              />
            );
          })}

          {/* Category circles */}
          {categoryNodes.map(cat => (
            <g key={cat.id}>
              <circle
                cx={cat.x}
                cy={cat.y}
                r={cat.r}
                fill={`url(#grad-${cat.category})`}
                stroke={cat.color}
                strokeWidth={1}
                strokeOpacity={hoveredNode ? (hoveredNode.category === cat.category ? 0.3 : 0.05) : 0.15}
                className="cursor-pointer transition-all duration-300"
                onClick={() => handleCategoryClick(cat.category)}
              />
              <text
                x={cat.x}
                y={cat.y - cat.r - 6}
                textAnchor="middle"
                className="fill-muted-foreground/40 select-none pointer-events-none"
                fontSize={11}
                fontWeight={500}
              >
                {cat.name} ({cat.children!.length})
              </text>
            </g>
          ))}

          {/* Project circles */}
          {allProjectNodes.map(node => {
            const isHovered = hoveredNode?.id === node.id;
            const isConnected = hoveredNode && hoveredConnections.some(
              c => c.from.id === node.id || c.to.id === node.id
            );
            const dimmed = hoveredNode && !isHovered && !isConnected;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => { setHoveredNode(null); setTooltip(null); }}
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      node,
                    });
                  }
                }}
                onClick={() => {
                  if (node.project) onProjectClick(node.project);
                }}
                className="cursor-pointer"
              >
                {isHovered && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r + 4}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={2}
                    strokeOpacity={0.5}
                    filter="url(#nodeGlow)"
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={node.color}
                  fillOpacity={dimmed ? 0.15 : isHovered ? 0.5 : 0.3}
                  stroke={node.color}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeOpacity={dimmed ? 0.1 : isHovered ? 0.8 : 0.4}
                  className="transition-all duration-200"
                />
                {node.project?.deepAnalyzedAt && (
                  <circle
                    cx={node.x + node.r * 0.6}
                    cy={node.y - node.r * 0.6}
                    r={3}
                    fill="#10b981"
                    fillOpacity={dimmed ? 0.1 : 0.7}
                    stroke="#064e3b"
                    strokeWidth={0.5}
                  />
                )}
                {node.r > 15 && (
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="currentColor"
                    className="fill-foreground select-none pointer-events-none"
                    fillOpacity={dimmed ? 0.1 : 0.8}
                    fontSize={Math.max(7, Math.min(12, node.r * 0.55))}
                    fontWeight={isHovered ? 600 : 400}
                  >
                    {node.name.length > 10 ? node.name.slice(0, 9) + '…' : node.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && hoveredNode?.project && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 pointer-events-none"
            style={{
              left: Math.min(tooltip.x + 12, size.w - 260),
              top: Math.min(tooltip.y - 10, size.h - 180),
            }}
          >
            <div className="w-60 bg-card/95 backdrop-blur-xl border border-border/30 rounded-lg shadow-xl shadow-black/30 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tooltip.node.color }}
                />
                <span className="text-sm font-semibold text-foreground truncate">
                  {tooltip.node.project.name}
                </span>
                {tooltip.node.project.deepAnalyzedAt && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 ml-auto shrink-0">
                    Verified
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground/60 mb-1.5">
                {tooltip.node.project.language || 'Unknown'} · {tooltip.node.category}
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-muted-foreground/40">Impact Score</span>
                <div className="flex-1 h-1.5 rounded-full bg-card/50 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, tooltip.node.score / 2)}%`,
                      backgroundColor: tooltip.node.color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground/50">{tooltip.node.score}</span>
              </div>
              {tooltip.node.project.deepSummary && (
                <p className="text-[10px] text-muted-foreground/40 leading-relaxed line-clamp-3">
                  {tooltip.node.project.deepSummary.slice(0, 120)}…
                </p>
              )}
              {!tooltip.node.project.deepSummary && tooltip.node.project.summary && (
                <p className="text-[10px] text-muted-foreground/40 leading-relaxed line-clamp-3">
                  {tooltip.node.project.summary.slice(0, 120)}…
                </p>
              )}
              {hoveredConnections.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/10 text-[10px] text-muted-foreground/30">
                  {hoveredConnections.length} connection{hoveredConnections.length !== 1 ? 's' : ''} · Click to view details
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
