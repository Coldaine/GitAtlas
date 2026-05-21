'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAtlasStore } from '@/lib/store';
import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { ProjectHoverCard } from '@/components/project-hover-card';
import { motion } from 'framer-motion';

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
}

interface ProjectGraphProps {
  projects: Project[];
}

export function ProjectGraph({ projects }: ProjectGraphProps) {
  const { setSelectedProject, activeTags } = useAtlasStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<NodePosition[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const animRef = useRef<number>(0);
  const nodesRef = useRef<NodePosition[]>([]);
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Build nodes and edges from projects
  const graphData = useMemo(() => {
    const nodeSize = (p: Project) => Math.max(8, Math.min(28, 8 + p.stargazersCount * 3));
    const nodeColor = (p: Project) => {
      if (p.category && CATEGORY_COLORS[p.category]) return CATEGORY_COLORS[p.category];
      if (p.language && LANGUAGE_COLORS[p.language]) return LANGUAGE_COLORS[p.language];
      return '#64748b';
    };

    const newNodes: NodePosition[] = projects.map((p, i) => {
      const angle = (i / projects.length) * Math.PI * 2;
      const spread = Math.min(dimensions.width, dimensions.height) * 0.3;
      return {
        id: p.id,
        x: dimensions.width / 2 + Math.cos(angle) * spread * (0.5 + Math.random()),
        y: dimensions.height / 2 + Math.sin(angle) * spread * (0.5 + Math.random()),
        vx: 0,
        vy: 0,
        project: p,
        radius: nodeSize(p),
        color: nodeColor(p),
      };
    });

    // Build edges based on shared tags
    const newEdges: Edge[] = [];
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const a = projects[i];
        const b = projects[j];
        const aTags = new Set([...a.tags, ...a.topics, a.language].filter(Boolean));
        const bTags = new Set([...b.tags, ...b.topics, b.language].filter(Boolean));
        const shared = [...aTags].filter((t) => bTags.has(t));
        if (shared.length >= 2) {
          newEdges.push({ source: a.id, target: b.id, weight: shared.length });
        }
      }
    }

    return { nodes: newNodes, edges: newEdges };
  }, [projects, dimensions]);

  // Resize observer
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.max(400, width), height: Math.max(300, height) });
      }
    });
    observer.observe(svg.parentElement || svg);
    return () => observer.disconnect();
  }, []);

  // Initialize nodes
  useEffect(() => {
    if (graphData.nodes.length > 0 && nodesRef.current.length === 0) {
      nodesRef.current = graphData.nodes.map((n) => ({ ...n }));
      setNodes(nodesRef.current);
      setEdges(graphData.edges);
    }
  }, [graphData]);

  // Force simulation
  useEffect(() => {
    if (nodesRef.current.length === 0) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const simulate = () => {
      const ns = nodesRef.current;
      const damping = 0.92;
      const repulsionStrength = 3000;
      const attractionStrength = 0.005;
      const centeringStrength = 0.01;

      // Repulsion between all pairs
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x;
          const dy = ns[i].y - ns[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsionStrength / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ns[i].vx += fx;
          ns[i].vy += fy;
          ns[j].vx -= fx;
          ns[j].vy -= fy;
        }
      }

      // Attraction along edges
      for (const edge of graphData.edges) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = 120;
        const force = (dist - idealDist) * attractionStrength * edge.weight;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // Centering force + update positions
      for (const node of ns) {
        if (draggingRef.current === node.id) continue;

        node.vx += (centerX - node.x) * centeringStrength;
        node.vy += (centerY - node.y) * centeringStrength;

        node.vx *= damping;
        node.vy *= damping;

        node.x += node.vx;
        node.y += node.vy;

        // Bounds
        const pad = node.radius + 5;
        node.x = Math.max(pad, Math.min(dimensions.width - pad, node.x));
        node.y = Math.max(pad, Math.min(dimensions.height - pad, node.y));
      }

      setNodes([...ns]);
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [graphData.edges, dimensions]);

  // Mouse handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });

      if (draggingRef.current) {
        const node = nodesRef.current.find((n) => n.id === draggingRef.current);
        if (node) {
          node.x = x + dragOffsetRef.current.x;
          node.y = y + dragOffsetRef.current.y;
          node.vx = 0;
          node.vy = 0;
        }
      }
    },
    []
  );

  const handleMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        draggingRef.current = nodeId;
        dragOffsetRef.current = { x: node.x - mousePos.x, y: node.y - mousePos.y };
      }
    },
    [mousePos]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  // Determine if node is dimmed (doesn't match active tags)
  const isNodeDimmed = useCallback(
    (node: NodePosition) => {
      if (activeTags.length === 0) return false;
      const projectTags = [...node.project.tags, ...node.project.topics];
      if (node.project.category) projectTags.push(node.project.category);
      return !activeTags.some((t) => projectTags.includes(t));
    },
    [activeTags]
  );

  // Get connected node IDs for hover highlighting
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>([hoveredNode]);
    for (const edge of graphData.edges) {
      if (edge.source === hoveredNode) connected.add(edge.target);
      if (edge.target === hoveredNode) connected.add(edge.source);
    }
    return connected;
  }, [hoveredNode, graphData.edges]);

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No projects to display
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Defs for glow effects */}
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
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const source = nodes.find((n) => n.id === edge.source);
          const target = nodes.find((n) => n.id === edge.target);
          if (!source || !target) return null;

          const isHighlighted = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
          const opacity = isHighlighted ? 0.5 : 0.08;

          return (
            <line
              key={`edge-${i}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isHighlighted ? '#10b981' : '#ffffff'}
              strokeWidth={isHighlighted ? Math.min(edge.weight * 0.8, 3) : 0.5}
              opacity={opacity}
              style={{ transition: 'opacity 0.3s, stroke-width 0.3s' }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id;
          const isConnected = connectedNodes.has(node.id);
          const dimmed = isNodeDimmed(node);
          const opacity = dimmed ? 0.15 : isHovered ? 1 : isConnected && hoveredNode ? 0.9 : 0.7;

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              onClick={() => setSelectedProject(node.project)}
              style={{ cursor: 'pointer', transition: 'opacity 0.3s' }}
              opacity={opacity}
            >
              {/* Glow ring on hover */}
              {isHovered && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 6}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={2}
                  opacity={0.4}
                  filter="url(#strongGlow)"
                />
              )}

              {/* Main circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? node.radius + 3 : node.radius}
                fill={node.color}
                opacity={isHovered ? 0.9 : 0.6}
                filter={isHovered ? 'url(#glow)' : undefined}
                style={{ transition: 'r 0.2s, opacity 0.2s' }}
              />

              {/* Inner highlight */}
              <circle
                cx={node.x - node.radius * 0.25}
                cy={node.y - node.radius * 0.25}
                r={node.radius * 0.3}
                fill="white"
                opacity={0.15}
              />

              {/* Label */}
              <text
                x={node.x}
                y={node.y + node.radius + 14}
                textAnchor="middle"
                fill={isHovered ? '#e2e8f0' : '#94a3b8'}
                fontSize={isHovered ? 11 : 9}
                fontWeight={isHovered ? '600' : '400'}
                className="pointer-events-none select-none"
                style={{ fontFamily: 'var(--font-geist-sans)' }}
              >
                {node.project.name.length > 18 ? node.project.name.slice(0, 16) + '…' : node.project.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover card */}
      {hoveredNode && (
        <ProjectHoverCard
          project={nodes.find((n) => n.id === hoveredNode)?.project}
          x={mousePos.x}
          y={mousePos.y}
        />
      )}
    </div>
  );
}
