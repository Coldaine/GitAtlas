'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAtlasStore } from '@/lib/store';
import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { ProjectHoverCard } from '@/components/project-hover-card';
import { RotateCcw } from 'lucide-react';

interface NodePosition {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  project: Project;
  radius: number;
  color: string;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
  type: 'tag' | 'dependency';
}

interface ProjectGraphProps {
  projects: Project[];
}

// Global cache for node positions to survive re-renders/view switches
const nodePositionCache = new Map<string, { x: number; y: number }>();

export function ProjectGraph({ projects }: ProjectGraphProps) {
  const { setSelectedProject, activeTags } = useAtlasStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<NodePosition[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const animRef = useRef<number>(0);
  const nodesRef = useRef<NodePosition[]>([]);
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);
  const edgesRef = useRef<Edge[]>([]);

  // Zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const nodeSize = useCallback((p: Project) => {
    const base = 10;
    const starBonus = Math.min(p.stargazersCount * 3, 15);
    const recencyBonus = p.pushedAt ? (Date.now() - new Date(p.pushedAt).getTime() < 30 * 24 * 60 * 60 * 1000 ? 3 : 0) : 0;
    return base + starBonus + recencyBonus;
  }, []);

  const nodeColor = useCallback((p: Project) => {
    if (p.category && CATEGORY_COLORS[p.category]) return CATEGORY_COLORS[p.category];
    if (p.language && LANGUAGE_COLORS[p.language]) return LANGUAGE_COLORS[p.language];
    return '#64748b';
  }, []);

  // Build edges from projects (both tag-based and dependency-based)
  const computedEdges = useMemo(() => {
    const newEdges: Edge[] = [];
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const a = projects[i];
        const b = projects[j];

        // Tag-based edges
        const aTags = new Set([...a.tags, ...a.topics, a.language].filter(Boolean));
        const bTags = new Set([...b.tags, ...b.topics, b.language].filter(Boolean));
        const shared = [...aTags].filter((t) => bTags.has(t));
        if (shared.length >= 2) {
          newEdges.push({ source: a.id, target: b.id, weight: shared.length, type: 'tag' });
        }

        // Dependency-based edges
        if (a.dependencies && b.dependencies) {
          const aAll = [...(a.dependencies.runtime || []), ...(a.dependencies.dev || [])];
          const bAll = [...(b.dependencies.runtime || []), ...(b.dependencies.dev || [])];
          const sharedDeps = aAll.filter(d => bAll.includes(d));
          if (sharedDeps.length >= 3) {
            newEdges.push({ source: a.id, target: b.id, weight: sharedDeps.length, type: 'dependency' });
          }
        }
      }
    }
    return newEdges;
  }, [projects]);

  // Category cluster labels — compute centroid for each category
  const categoryLabels = useMemo(() => {
    const catNodes = new Map<string, { xSum: number; ySum: number; count: number; color: string }>();
    for (const node of nodes) {
      const cat = node.project.category;
      if (!cat) continue;
      const existing = catNodes.get(cat);
      if (existing) {
        existing.xSum += node.x;
        existing.ySum += node.y;
        existing.count += 1;
      } else {
        catNodes.set(cat, {
          xSum: node.x,
          ySum: node.y,
          count: 1,
          color: CATEGORY_COLORS[cat] || '#64748b',
        });
      }
    }
    return [...catNodes.entries()].map(([cat, data]) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      x: data.xSum / data.count,
      y: data.ySum / data.count - 40,
      color: data.color,
      count: data.count,
    }));
  }, [nodes]);

  // Category counts for legend
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => { if (p.category) map.set(p.category, (map.get(p.category) || 0) + 1); });
    return [...map.entries()].map(([name, count]) => ({
      name,
      count,
      color: CATEGORY_COLORS[name] || '#64748b',
    })).sort((a, b) => b.count - a.count);
  }, [projects]);

  // Gradient definitions for edges
  const edgeGradients = useMemo(() => {
    const gradients: { id: string; fromColor: string; toColor: string }[] = [];
    for (const edge of computedEdges) {
      if (edge.type === 'tag') {
        const sourceP = projects.find(p => p.id === edge.source);
        const targetP = projects.find(p => p.id === edge.target);
        const fromColor = sourceP?.category ? CATEGORY_COLORS[sourceP.category] : '#64748b';
        const toColor = targetP?.category ? CATEGORY_COLORS[targetP.category] : '#64748b';
        gradients.push({ id: `grad-${edge.source}-${edge.target}`, fromColor, toColor });
      }
    }
    return gradients;
  }, [computedEdges, projects]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.max(400, width), height: Math.max(300, height) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Initialize nodes (use cached positions if available)
  useEffect(() => {
    if (projects.length === 0) return;

    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const spread = Math.min(dimensions.width, dimensions.height) * 0.3;

    const newNodes: NodePosition[] = projects.map((p, i) => {
      const cached = nodePositionCache.get(p.id);
      const angle = (i / projects.length) * Math.PI * 2;

      return {
        id: p.id,
        x: cached?.x ?? (cx + Math.cos(angle) * spread * (0.5 + Math.random() * 0.5)),
        y: cached?.y ?? (cy + Math.sin(angle) * spread * (0.5 + Math.random() * 0.5)),
        vx: 0,
        vy: 0,
        project: p,
        radius: nodeSize(p),
        color: nodeColor(p),
      };
    });

    nodesRef.current = newNodes;
    edgesRef.current = computedEdges;
    setNodes([...newNodes]);
    setEdges(computedEdges);
    initializedRef.current = true;
  }, [projects, dimensions, computedEdges, nodeSize, nodeColor]);

  // Force simulation
  useEffect(() => {
    if (!initializedRef.current || nodesRef.current.length === 0) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const simulate = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      const damping = 0.92;
      const repulsionStrength = 3500;
      const attractionStrength = 0.004;
      const centeringStrength = 0.008;

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x;
          const dy = ns[i].y - ns[j].y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq) || 1;
          const force = repulsionStrength / (distSq + 100);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ns[i].vx += fx;
          ns[i].vy += fy;
          ns[j].vx -= fx;
          ns[j].vy -= fy;
        }
      }

      // Attraction
      for (const edge of es) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = edge.type === 'dependency' ? 100 : 130;
        const strength = edge.type === 'dependency' ? attractionStrength * 1.5 : attractionStrength;
        const force = (dist - idealDist) * strength * edge.weight;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // Update
      for (const node of ns) {
        if (draggingRef.current === node.id) continue;

        node.vx += (centerX - node.x) * centeringStrength;
        node.vy += (centerY - node.y) * centeringStrength;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;

        const pad = node.radius + 10;
        node.x = Math.max(pad, Math.min(dimensions.width - pad, node.x));
        node.y = Math.max(pad, Math.min(dimensions.height - pad, node.y));

        // Cache position
        nodePositionCache.set(node.id, { x: node.x, y: node.y });
      }

      setNodes([...ns]);
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [dimensions]);

  // Zoom with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.3, Math.min(3, zoomRef.current * delta));
    zoomRef.current = newZoom;
    setZoom(newZoom);
  }, []);

  // Pan with background drag
  const handleBgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest('.graph-node')) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();

      const svgX = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
      const svgY = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
      setMousePos({ x: svgX, y: svgY });

      if (isPanningRef.current) {
        const newPan = {
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        };
        panRef.current = newPan;
        setPan(newPan);
      }

      if (draggingRef.current) {
        const node = nodesRef.current.find((n) => n.id === draggingRef.current);
        if (node) {
          node.x = svgX + dragOffsetRef.current.x;
          node.y = svgY + dragOffsetRef.current.y;
          node.vx = 0;
          node.vy = 0;
        }
      }
    },
    [zoom]
  );

  const handleMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        draggingRef.current = nodeId;
        const rect = svgRef.current?.getBoundingClientRect();
        const svgX = rect ? (e.clientX - rect.left - panRef.current.x) / zoomRef.current : e.clientX;
        const svgY = rect ? (e.clientY - rect.top - panRef.current.y) / zoomRef.current : e.clientY;
        dragOffsetRef.current = { x: node.x - svgX, y: node.y - svgY };
      }
    },
    [zoom]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    isPanningRef.current = false;
  }, []);

  const isNodeDimmed = useCallback(
    (node: NodePosition) => {
      if (activeTags.length === 0) return false;
      const projectTags = [...node.project.tags, ...node.project.topics];
      if (node.project.category) projectTags.push(node.project.category);
      return !activeTags.some((t) => projectTags.includes(t));
    },
    [activeTags]
  );

  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>([hoveredNode]);
    for (const edge of edges) {
      if (edge.source === hoveredNode) connected.add(edge.target);
      if (edge.target === hoveredNode) connected.add(edge.source);
    }
    return connected;
  }, [hoveredNode, edges]);

  // Get category icon initial letter
  const categoryIcon = useCallback((cat: string | null) => {
    if (!cat) return '?';
    const map: Record<string, string> = {
      tool: '⚙', library: '📚', application: '🖥', template: '📋',
      experiment: '🧪', config: '🔧', documentation: '📖', learning: '🎓', archive: '📦',
    };
    return map[cat] || '●';
  }, []);

  // Reset view handler
  const handleResetView = useCallback(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Minimap dimensions
  const minimapWidth = 120;
  const minimapHeight = 80;
  const minimapPadding = 8;

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No projects to display
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleBgMouseDown}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="strongGlow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.3)" />
          </filter>
          {/* Edge gradient definitions */}
          {edgeGradients.map(g => (
            <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={g.fromColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={g.toColor} stopOpacity="0.3" />
            </linearGradient>
          ))}
          {/* Deep analysis emerald particle animation */}
          <style>{`
            @keyframes emeraldPulse {
              0% { opacity: 0.15; r: inherit; }
              50% { opacity: 0.35; }
              100% { opacity: 0.15; }
            }
            .deep-glow {
              animation: emeraldPulse 2s ease-in-out infinite;
            }
          `}</style>
        </defs>

        {/* Background grid pattern */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Main graph group with zoom/pan transform */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Category cluster labels — background labels at centroid */}
          {categoryLabels.map((cl, i) => (
            <text
              key={`cluster-${i}`}
              x={cl.x}
              y={cl.y}
              textAnchor="middle"
              fill={cl.color}
              fontSize={11}
              fontWeight="500"
              opacity={0.15}
              className="pointer-events-none select-none"
              style={{ fontFamily: 'var(--font-geist-sans)' }}
            >
              {cl.label} ({cl.count})
            </text>
          ))}

          {/* Edges */}
          {edges.map((edge, i) => {
            const source = nodes.find((n) => n.id === edge.source);
            const target = nodes.find((n) => n.id === edge.target);
            if (!source || !target) return null;

            const isHighlighted = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
            const isDependency = edge.type === 'dependency';

            const baseColor = isDependency ? '#3b82f6' : '#ffffff';
            const highlightColor = isDependency ? '#60a5fa' : '#10b981';
            const color = isHighlighted ? highlightColor : baseColor;
            const opacity = isHighlighted ? 0.6 : isDependency ? 0.08 : 0.06;

            // Use gradient for tag edges when highlighted
            const gradientId = `grad-${edge.source}-${edge.target}`;
            const stroke = isHighlighted && !isDependency ? `url(#${gradientId})` : color;

            return (
              <line
                key={`edge-${i}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={stroke}
                strokeWidth={isHighlighted ? Math.min(edge.weight * 1, 3) : isDependency ? 1 : 0.5}
                opacity={opacity}
                strokeDasharray={isDependency && !isHighlighted ? '4 4' : undefined}
                style={{ transition: 'opacity 0.3s, stroke-width 0.3s' }}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredNode === node.id;
            const isConnected = connectedNodes.has(node.id);
            const dimmed = isNodeDimmed(node);
            const opacity = dimmed ? 0.12 : isHovered ? 1 : isConnected && hoveredNode ? 0.85 : 0.65;
            const isDeepAnalyzed = !!node.project.deepAnalyzedAt;

            return (
              <g
                key={node.id}
                className="graph-node"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                onClick={() => setSelectedProject(node.project)}
                style={{ cursor: 'pointer', transition: 'opacity 0.3s' }}
                opacity={opacity}
              >
                {/* Outer glow ring on hover */}
                {isHovered && (
                  <>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius + 10}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={1.5}
                      opacity={0.2}
                      filter="url(#strongGlow)"
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius + 5}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={2}
                      opacity={0.4}
                    />
                  </>
                )}

                {/* Deep analysis ring — emerald ring with glow animation */}
                {isDeepAnalyzed && !isHovered && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius + 5}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    opacity={0.2}
                    className="deep-glow"
                    filter="url(#glow)"
                  />
                )}
                {isDeepAnalyzed && !isHovered && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius + 4}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    opacity={0.35}
                    strokeDasharray="3 2"
                  />
                )}

                {/* Shadow */}
                <circle
                  cx={node.x + 2}
                  cy={node.y + 2}
                  r={isHovered ? node.radius + 2 : node.radius}
                  fill="rgba(0,0,0,0.3)"
                />

                {/* Main circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? node.radius + 2 : node.radius}
                  fill={node.color}
                  opacity={isHovered ? 0.95 : isDeepAnalyzed ? 0.8 : 0.65}
                  filter={isHovered ? 'url(#glow)' : isDeepAnalyzed ? 'url(#glow)' : undefined}
                  stroke={isHovered ? 'rgba(255,255,255,0.3)' : isDeepAnalyzed ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isHovered ? 2 : isDeepAnalyzed ? 1.5 : 1}
                />

                {/* Category icon in center for larger nodes */}
                {node.radius >= 12 && (
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={node.radius * 0.7}
                    className="pointer-events-none select-none"
                  >
                    {categoryIcon(node.project.category)}
                  </text>
                )}

                {/* Label */}
                <text
                  x={node.x}
                  y={node.y + node.radius + 15}
                  textAnchor="middle"
                  fill={isHovered ? '#e2e8f0' : '#94a3b8'}
                  fontSize={isHovered ? 11 : 9}
                  fontWeight={isHovered ? '600' : '400'}
                  className="pointer-events-none select-none"
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  {node.project.name.length > 18 ? node.project.name.slice(0, 16) + '…' : node.project.name}
                </text>

                {/* Activity indicator - small dot for recently active */}
                {node.project.pushedAt && (Date.now() - new Date(node.project.pushedAt).getTime() < 7 * 24 * 60 * 60 * 1000) && (
                  <circle
                    cx={node.x + node.radius * 0.65}
                    cy={node.y - node.radius * 0.65}
                    r={3}
                    fill="#10b981"
                    stroke="#0a0a0a"
                    strokeWidth={1.5}
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Minimap */}
        <g>
          {/* Minimap background */}
          <rect
            x={dimensions.width - minimapWidth - minimapPadding}
            y={minimapPadding}
            width={minimapWidth}
            height={minimapHeight}
            rx={4}
            fill="rgba(10,10,10,0.8)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />

          {/* Minimap viewport rectangle */}
          {(() => {
            const scaleX = minimapWidth / dimensions.width;
            const scaleY = minimapHeight / dimensions.height;
            const scale = Math.min(scaleX, scaleY) * 0.9;
            const offsetX = dimensions.width - minimapWidth - minimapPadding + (minimapWidth - dimensions.width * scale) / 2;
            const offsetY = minimapPadding + (minimapHeight - dimensions.height * scale) / 2;

            const vpX = offsetX + (-pan.x / zoom) * scale;
            const vpY = offsetY + (-pan.y / zoom) * scale;
            const vpW = (dimensions.width / zoom) * scale;
            const vpH = (dimensions.height / zoom) * scale;

            return (
              <>
                {/* Minimap nodes */}
                {nodes.map(node => {
                  const mx = offsetX + node.x * scale;
                  const my = offsetY + node.y * scale;
                  const mr = Math.max(1.5, node.radius * scale * 0.5);
                  const dimmed = isNodeDimmed(node);
                  return (
                    <circle
                      key={`mini-${node.id}`}
                      cx={mx}
                      cy={my}
                      r={mr}
                      fill={node.color}
                      opacity={dimmed ? 0.15 : 0.5}
                      className="pointer-events-none"
                    />
                  );
                })}
                {/* Viewport outline */}
                <rect
                  x={vpX}
                  y={vpY}
                  width={vpW}
                  height={vpH}
                  fill="none"
                  stroke="rgba(16,185,129,0.5)"
                  strokeWidth={1}
                  rx={1}
                />
              </>
            );
          })()}
        </g>

        {/* Zoom indicator */}
        <text
          x={dimensions.width - minimapWidth - minimapPadding}
          y={minimapPadding + minimapHeight + 14}
          textAnchor="start"
          fill="rgba(148,163,184,0.3)"
          fontSize={9}
          className="pointer-events-none select-none"
        >
          {Math.round(zoom * 100)}%
        </text>

        {/* Edge legend */}
        <g>
          <line
            x1={dimensions.width - minimapWidth - minimapPadding}
            y1={minimapPadding + minimapHeight + 22}
            x2={dimensions.width - minimapWidth - minimapPadding + 15}
            y2={minimapPadding + minimapHeight + 22}
            stroke="#ffffff"
            strokeWidth={0.5}
            opacity={0.3}
          />
          <text
            x={dimensions.width - minimapWidth - minimapPadding + 19}
            y={minimapPadding + minimapHeight + 25}
            fill="rgba(148,163,184,0.3)"
            fontSize={7}
            className="pointer-events-none select-none"
          >
            Tags
          </text>
          <line
            x1={dimensions.width - minimapWidth - minimapPadding}
            y1={minimapPadding + minimapHeight + 32}
            x2={dimensions.width - minimapWidth - minimapPadding + 15}
            y2={minimapPadding + minimapHeight + 32}
            stroke="#3b82f6"
            strokeWidth={1}
            opacity={0.4}
            strokeDasharray="4 4"
          />
          <text
            x={dimensions.width - minimapWidth - minimapPadding + 19}
            y={minimapPadding + minimapHeight + 35}
            fill="rgba(148,163,184,0.3)"
            fontSize={7}
            className="pointer-events-none select-none"
          >
            Deps
          </text>
          {/* Deep analyzed legend */}
          <circle
            cx={dimensions.width - minimapWidth - minimapPadding + 6}
            cy={minimapPadding + minimapHeight + 43}
            r={4}
            fill="none"
            stroke="#10b981"
            strokeWidth={1.5}
            opacity={0.4}
            strokeDasharray="3 2"
          />
          <text
            x={dimensions.width - minimapWidth - minimapPadding + 19}
            y={minimapPadding + minimapHeight + 46}
            fill="rgba(148,163,184,0.3)"
            fontSize={7}
            className="pointer-events-none select-none"
          >
            Verified
          </text>
          {/* Category counts */}
          {categoryCounts.slice(0, 3).map((cat, i) => (
            <g key={cat.name}>
              <circle
                cx={dimensions.width - minimapWidth - minimapPadding + 3}
                cy={minimapPadding + minimapHeight + 54 + i * 10}
                r={2.5}
                fill={cat.color}
                opacity={0.5}
              />
              <text
                x={dimensions.width - minimapWidth - minimapPadding + 19}
                y={minimapPadding + minimapHeight + 57 + i * 10}
                fill="rgba(148,163,184,0.3)"
                fontSize={7}
                className="pointer-events-none select-none"
              >
                {cat.name} ({cat.count})
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Reset View button */}
      <button
        onClick={handleResetView}
        className="absolute bottom-12 left-3 p-1.5 rounded-md bg-card/60 backdrop-blur-sm border border-border/20 text-muted-foreground/40 hover:text-foreground/60 hover:bg-card/80 transition-colors"
        title="Reset View"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      {/* Hover card */}
      {hoveredNode && (
        <ProjectHoverCard
          project={nodes.find((n) => n.id === hoveredNode)?.project}
          x={mousePos.x * zoom + pan.x}
          y={mousePos.y * zoom + pan.y}
        />
      )}
    </div>
  );
}
