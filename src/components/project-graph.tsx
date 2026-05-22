'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAtlasStore } from '@/lib/store';
import { Project, CATEGORY_COLORS, LANGUAGE_COLORS, ColorBy, NodeSizeBy } from '@/lib/types';
import { ProjectHoverCard } from '@/components/project-hover-card';
import { GraphLegend } from '@/components/graph-legend';
import { RotateCcw, ExternalLink, Sparkles, Bookmark, FileText } from 'lucide-react';

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
  sharedItems?: string[];
}

interface ProjectGraphProps {
  projects: Project[];
}

// Global cache for node positions
const nodePositionCache = new Map<string, { x: number; y: number }>();

// Floating particle type
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
  targetOpacity: number;
  phase: number;
}

// Compute health score for node ring
function computeHealth(project: { pushedAt?: string | null; openIssuesCount: number; isArchived: boolean; stargazersCount: number }): number {
  if (project.isArchived) return 0;
  let score = 50;
  if (project.pushedAt) {
    const daysSince = (Date.now() - new Date(project.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) score += 30;
    else if (daysSince < 30) score += 20;
    else if (daysSince < 90) score += 10;
    else if (daysSince > 365) score -= 20;
  }
  if (project.stargazersCount > 10) score += 15;
  else if (project.stargazersCount > 3) score += 10;
  else if (project.stargazersCount > 0) score += 5;
  if (project.openIssuesCount > 20) score -= 5;
  else if (project.openIssuesCount > 5) score -= 2;
  return Math.max(0, Math.min(100, score));
}

// Count files in a file tree recursively
function countFiles(tree: { type: string; children?: { type: string; children?: unknown[] }[] }): number {
  let count = tree.type === 'file' ? 1 : 0;
  if (tree.children) {
    for (const child of tree.children) {
      count += countFiles(child as { type: string; children?: { type: string; children?: unknown[] }[] });
    }
  }
  return count;
}

export function ProjectGraph({ projects }: ProjectGraphProps) {
  const { setSelectedProject, activeTags, nodeSizeBy, colorBy, edgeThreshold, showParticles, showClusterBackgrounds, showHealthRings, showDependencyEdges, animationSpeed } = useAtlasStore();
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

  // Hovered edge tooltip state
  const [hoveredEdgeInfo, setHoveredEdgeInfo] = useState<{ x: number; y: number; label: string } | null>(null);

  // Connections panel state (shown on node click)
  const [connectionsPanel, setConnectionsPanel] = useState<{ nodeId: string; connections: { nodeId: string; projectName: string; sharedItems: string[]; edgeType: 'tag' | 'dependency' }[] } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // Animated pulse edges
  const [pulseProgress, setPulseProgress] = useState(0);
  const pulseAnimRef = useRef<number>(0);

  // Floating particles
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 800,
      y: Math.random() * 600,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1 + Math.random() * 2,
      opacity: 0.03 + Math.random() * 0.05,
      targetOpacity: 0.03 + Math.random() * 0.05,
      phase: Math.random() * Math.PI * 2,
    }))
  );
  const particlesRef = useRef(particles);

  const nodeSize = useCallback((p: Project) => {
    const base = 10;
    switch (nodeSizeBy) {
      case 'stars':
        return base + Math.min(p.stargazersCount * 3, 18);
      case 'activity': {
        if (!p.pushedAt) return base;
        const daysSince = (Date.now() - new Date(p.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) return base + 12;
        if (daysSince < 30) return base + 8;
        if (daysSince < 90) return base + 4;
        if (daysSince > 365) return base - 2;
        return base;
      }
      case 'dependencies': {
        const depCount = p.dependencies
          ? (p.dependencies.runtime?.length || 0) + (p.dependencies.dev?.length || 0)
          : 0;
        return base + Math.min(depCount * 0.5, 14);
      }
      case 'files': {
        const fileCount = p.fileTree ? countFiles(p.fileTree) : 0;
        return base + Math.min(fileCount * 0.05, 14);
      }
      default: {
        const starBonus = Math.min(p.stargazersCount * 3, 15);
        const recencyBonus = p.pushedAt ? (Date.now() - new Date(p.pushedAt).getTime() < 30 * 24 * 60 * 60 * 1000 ? 3 : 0) : 0;
        return base + starBonus + recencyBonus;
      }
    }
  }, [nodeSizeBy]);

  const nodeColor = useCallback((p: Project) => {
    switch (colorBy) {
      case 'category':
        if (p.category && CATEGORY_COLORS[p.category]) return CATEGORY_COLORS[p.category];
        if (p.language && LANGUAGE_COLORS[p.language]) return LANGUAGE_COLORS[p.language];
        return '#64748b';
      case 'language':
        if (p.language && LANGUAGE_COLORS[p.language]) return LANGUAGE_COLORS[p.language];
        if (p.category && CATEGORY_COLORS[p.category]) return CATEGORY_COLORS[p.category];
        return '#64748b';
      case 'health': {
        const score = computeHealth(p);
        if (score >= 70) return '#10b981';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
      }
      case 'activity': {
        if (!p.pushedAt) return '#64748b';
        const daysSince = (Date.now() - new Date(p.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) return '#10b981';
        if (daysSince < 30) return '#84cc16';
        if (daysSince < 180) return '#f59e0b';
        return '#64748b';
      }
      default:
        if (p.category && CATEGORY_COLORS[p.category]) return CATEGORY_COLORS[p.category];
        return '#64748b';
    }
  }, [colorBy]);

  // Build edges from projects — respects edgeThreshold and showDependencyEdges
  const computedEdges = useMemo(() => {
    const newEdges: Edge[] = [];
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const a = projects[i];
        const b = projects[j];

        const aTags = new Set([...a.tags, ...a.topics, a.language].filter(Boolean));
        const bTags = new Set([...b.tags, ...b.topics, b.language].filter(Boolean));
        const shared = [...aTags].filter((t) => bTags.has(t));
        if (shared.length >= edgeThreshold) {
          newEdges.push({ source: a.id, target: b.id, weight: shared.length, type: 'tag', sharedItems: shared });
        }

        if (showDependencyEdges && a.dependencies && b.dependencies) {
          const aAll = [...(a.dependencies.runtime || []), ...(a.dependencies.dev || [])];
          const bAll = [...(b.dependencies.runtime || []), ...(b.dependencies.dev || [])];
          const sharedDeps = aAll.filter(d => bAll.includes(d));
          if (sharedDeps.length >= Math.max(edgeThreshold, 3)) {
            newEdges.push({ source: a.id, target: b.id, weight: sharedDeps.length, type: 'dependency', sharedItems: sharedDeps });
          }
        }
      }
    }
    return newEdges;
  }, [projects, edgeThreshold, showDependencyEdges]);

  // Category cluster labels
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

  // Category cluster backgrounds (blurred circles at centroids)
  const clusterBackgrounds = useMemo(() => {
    return categoryLabels.map(cl => ({
      ...cl,
      radius: Math.max(60, cl.count * 25),
    }));
  }, [categoryLabels]);

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

  // Edge hub detection - where many edges converge
  const hubNodes = useMemo(() => {
    const edgeCounts = new Map<string, number>();
    for (const edge of computedEdges) {
      edgeCounts.set(edge.source, (edgeCounts.get(edge.source) || 0) + 1);
      edgeCounts.set(edge.target, (edgeCounts.get(edge.target) || 0) + 1);
    }
    return [...edgeCounts.entries()].filter(([, count]) => count >= 4).map(([id]) => id);
  }, [computedEdges]);

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

  // Initialize nodes
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

        nodePositionCache.set(node.id, { x: node.x, y: node.y });
      }

      // Update particles
      const pRef = particlesRef.current;
      for (const p of pRef) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += 0.01;
        p.opacity = p.targetOpacity + Math.sin(p.phase) * 0.02;

        // Wrap around
        if (p.x < 0) p.x = dimensions.width;
        if (p.x > dimensions.width) p.x = 0;
        if (p.y < 0) p.y = dimensions.height;
        if (p.y > dimensions.height) p.y = 0;
      }

      setNodes([...ns]);
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [dimensions]);

  // Pulse animation for hovered edges
  useEffect(() => {
    if (!hoveredNode) {
      setPulseProgress(0);
      return;
    }

    const animate = () => {
      setPulseProgress(prev => (prev + 0.015) % 1);
      pulseAnimRef.current = requestAnimationFrame(animate);
    };
    pulseAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(pulseAnimRef.current);
  }, [hoveredNode]);

  // Close context menu on click elsewhere
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

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

  // Double-click to zoom to node
  const handleDoubleClick = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const targetZoom = 2;
    const targetPanX = dimensions.width / 2 - node.x * targetZoom;
    const targetPanY = dimensions.height / 2 - node.y * targetZoom;

    // Animate zoom/pan
    const startZoom = zoomRef.current;
    const startPanX = panRef.current.x;
    const startPanY = panRef.current.y;
    const duration = 400;
    const start = performance.now();

    const animateZoom = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut

      const currentZoom = startZoom + (targetZoom - startZoom) * ease;
      const currentPanX = startPanX + (targetPanX - startPanX) * ease;
      const currentPanY = startPanY + (targetPanY - startPanY) * ease;

      zoomRef.current = currentZoom;
      panRef.current = { x: currentPanX, y: currentPanY };
      setZoom(currentZoom);
      setPan({ x: currentPanX, y: currentPanY });

      if (t < 1) requestAnimationFrame(animateZoom);
    };

    requestAnimationFrame(animateZoom);
  }, [dimensions]);

  // Right-click context menu
  const handleContextMenu = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      nodeId,
    });
  }, []);

  const handleContextAction = useCallback((action: string, nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const project = node.project;

    switch (action) {
      case 'github':
        window.open(project.htmlUrl, '_blank');
        break;
      case 'details':
        setSelectedProject(project);
        break;
      case 'bookmark': {
        const bookmarks = JSON.parse(localStorage.getItem('git-atlas-bookmarks') || '[]');
        if (!bookmarks.includes(project.id)) {
          localStorage.setItem('git-atlas-bookmarks', JSON.stringify([...bookmarks, project.id]));
        }
        break;
      }
      case 'analyze':
        fetch('/api/github/deep-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, username: project.ownerLogin }),
        });
        break;
    }
    setContextMenu(null);
  }, [setSelectedProject]);

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

  // Get category icon — expanded with more expressive emoji
  const CATEGORY_EMOJI: Record<string, string> = {
    tool: '⚙️',
    library: '📚',
    application: '🖥️',
    template: '📋',
    experiment: '🧪',
    config: '🔧',
    documentation: '📖',
    learning: '🎓',
    archive: '📦',
    // NEW:
    ai: '🧠',
    creative: '🎨',
    security: '🔒',
    data: '📊',
    infra: '🏗️',
    web: '🌐',
  };

  const categoryIcon = useCallback((cat: string | null) => {
    if (!cat) return '?';
    return CATEGORY_EMOJI[cat] || '●';
  }, [CATEGORY_EMOJI]);

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
        onContextMenu={(e) => e.preventDefault()}
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
          {/* Inner shadow for depth */}
          <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
            <feOffset dx="0" dy="1" result="offsetBlur" />
            <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowDiff" />
            <feFlood floodColor="rgba(0,0,0,0.3)" result="color" />
            <feComposite in="color" in2="shadowDiff" operator="in" result="shadow" />
            <feComposite in="SourceGraphic" in2="shadow" operator="over" />
          </filter>
          {/* Blur filter for cluster backgrounds */}
          <filter id="clusterBlur">
            <feGaussianBlur stdDeviation="30" />
          </filter>
          {/* Minimap glow */}
          <filter id="minimapGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Edge gradient definitions */}
          {edgeGradients.map(g => (
            <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={g.fromColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={g.toColor} stopOpacity="0.3" />
            </linearGradient>
          ))}
          <style>{`
            @keyframes emeraldPulse {
              0% { opacity: 0.15; }
              50% { opacity: 0.35; }
              100% { opacity: 0.15; }
            }
            .deep-glow {
              animation: emeraldPulse 2s ease-in-out infinite;
            }
            @keyframes pulseDash {
              0% { stroke-dashoffset: 20; }
              100% { stroke-dashoffset: 0; }
            }
            .pulse-edge {
              animation: pulseDash 1s linear infinite;
            }
          `}</style>
        </defs>

        {/* Background grid pattern */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Ambient floating particles */}
        {particlesRef.current.map(p => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="rgba(255,255,255,1)"
            opacity={Math.max(0.01, Math.min(0.08, p.opacity))}
            className="pointer-events-none select-none"
          />
        ))}

        {/* Main graph group with zoom/pan transform */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Category cluster backgrounds — soft blurred clouds */}
          {clusterBackgrounds.map((cl, i) => (
            <circle
              key={`cluster-bg-${i}`}
              cx={cl.x}
              cy={cl.y + 20}
              r={cl.radius}
              fill={cl.color}
              opacity={0.03}
              filter="url(#clusterBlur)"
              className="pointer-events-none select-none"
            />
          ))}

          {/* Category cluster labels */}
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

          {/* Edges — with weight-based thickness, connection badges, and hover tooltips */}
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

            const gradientId = `grad-${edge.source}-${edge.target}`;
            const stroke = isHighlighted && !isDependency ? `url(#${gradientId})` : color;

            // Edge weight: thicker edges = more shared items
            const baseWidth = isDependency
              ? Math.min(1 + (edge.weight - 3) * 0.5, 4) // base 1, +0.5 per shared dep, max 4
              : Math.min(0.5 + (edge.weight - 2) * 0.3, 3); // base 0.5, +0.3 per shared tag, max 3
            const highlightedWidth = isDependency
              ? Math.min(baseWidth + 1.5, 5)
              : Math.min(baseWidth + 1, 4);
            const strokeWidth = isHighlighted ? highlightedWidth : baseWidth;

            // Midpoint for badge/tooltip
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            // Compute pulse position along edge
            const px = source.x + (target.x - source.x) * pulseProgress;
            const py = source.y + (target.y - source.y) * pulseProgress;

            // Build tooltip label
            const sharedLabel = isDependency
              ? `Shared deps: ${(edge.sharedItems || []).slice(0, 5).join(', ')}${(edge.sharedItems || []).length > 5 ? '...' : ''}`
              : `Shared: ${(edge.sharedItems || []).slice(0, 5).join(', ')}${(edge.sharedItems || []).length > 5 ? '...' : ''}`;

            return (
              <g key={`edge-${i}`}>
                {/* Glow layer for highlighted edges */}
                {isHighlighted && (
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={highlightColor}
                    strokeWidth={strokeWidth + 4}
                    opacity={0.12}
                    className="pointer-events-none"
                    filter="url(#glow)"
                  />
                )}
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  strokeDasharray={isDependency && !isHighlighted ? '4 4' : undefined}
                  style={{ transition: 'opacity 0.3s, stroke-width 0.3s' }}
                />
                {/* Invisible wider hit area for edge hover */}
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="transparent"
                  strokeWidth={12}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHoveredEdgeInfo({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      label: sharedLabel,
                    });
                  }}
                  onMouseLeave={() => setHoveredEdgeInfo(null)}
                />
                {/* Animated pulse dot traveling along highlighted edge */}
                {isHighlighted && (
                  <circle
                    cx={px}
                    cy={py}
                    r={2.5}
                    fill={highlightColor}
                    opacity={0.8}
                    className="pointer-events-none"
                    filter="url(#glow)"
                  />
                )}
                {/* Connection count badge at midpoint for highlighted edges */}
                {isHighlighted && (
                  <g className="pointer-events-none">
                    <circle
                      cx={midX}
                      cy={midY}
                      r={8}
                      fill="rgba(10,10,10,0.85)"
                      stroke={highlightColor}
                      strokeWidth={1}
                      opacity={0.9}
                    />
                    <text
                      x={midX}
                      y={midY + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={highlightColor}
                      fontSize={7}
                      fontWeight="700"
                      style={{ fontFamily: 'var(--font-geist-sans)' }}
                    >
                      {edge.weight}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Edge hub glow — where many edges converge */}
          {hubNodes.map(nodeId => {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return null;
            const isHovered = hoveredNode === nodeId;
            if (isHovered) return null; // Already shown via hover effects
            return (
              <circle
                key={`hub-${nodeId}`}
                cx={node.x}
                cy={node.y}
                r={node.radius + 12}
                fill={node.color}
                opacity={0.04}
                filter="url(#strongGlow)"
                className="pointer-events-none"
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
            const healthScore = computeHealth(node.project);
            const healthColor = healthScore >= 70 ? '#10b981' : healthScore >= 40 ? '#f59e0b' : '#ef4444';
            const healthDashArray = `${(healthScore / 100) * (2 * Math.PI * (node.radius + 7))} ${2 * Math.PI * (node.radius + 7)}`;

            return (
              <g
                key={node.id}
                className="graph-node"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                onDoubleClick={() => handleDoubleClick(node.id)}
                onContextMenu={(e) => handleContextMenu(node.id, e)}
                onClick={() => {
                  setSelectedProject(node.project);
                  // Show connections panel
                  const conns: { nodeId: string; projectName: string; sharedItems: string[]; edgeType: 'tag' | 'dependency' }[] = [];
                  for (const edge of edgesRef.current) {
                    if (edge.source === node.id) {
                      const targetP = projects.find(p => p.id === edge.target);
                      if (targetP) conns.push({ nodeId: edge.target, projectName: targetP.name, sharedItems: edge.sharedItems || [], edgeType: edge.type });
                    } else if (edge.target === node.id) {
                      const sourceP = projects.find(p => p.id === edge.source);
                      if (sourceP) conns.push({ nodeId: edge.source, projectName: sourceP.name, sharedItems: edge.sharedItems || [], edgeType: edge.type });
                    }
                  }
                  setConnectionsPanel(conns.length > 0 ? { nodeId: node.id, connections: conns } : null);
                }}
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

                {/* Health score ring */}
                {!isHovered && !node.project.isArchived && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius + 7}
                    fill="none"
                    stroke={healthColor}
                    strokeWidth={1}
                    opacity={0.15}
                    strokeDasharray={healthDashArray}
                    strokeLinecap="round"
                    className="pointer-events-none"
                    style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
                  />
                )}

                {/* Shadow */}
                <circle
                  cx={node.x + 2}
                  cy={node.y + 2}
                  r={isHovered ? node.radius + 2 : node.radius}
                  fill="rgba(0,0,0,0.3)"
                />

                {/* Main circle with inner shadow */}
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

                {/* Inner shadow for depth */}
                <circle
                  cx={node.x}
                  cy={node.y - 1}
                  r={isHovered ? node.radius : node.radius - 1}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={0.5}
                  className="pointer-events-none"
                />

                {/* Category icon in center — larger for better visibility */}
                {node.radius >= 12 && (
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={node.radius * 0.8}
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

                {/* Activity indicator (green dot for recent push) */}
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

                {/* Special badge icons at top-right of node */}
                {(() => {
                  const badges: { emoji: string; title: string }[] = [];
                  const p = node.project;

                  // 🦅 Phoenix/Firebird — flagship projects (≥5 stars)
                  if (p.stargazersCount >= 5) badges.push({ emoji: '🦅', title: 'Flagship (≥5 stars)' });
                  // 🔥 Hot — pushed in last 7 days
                  if (p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() < 7 * 24 * 60 * 60 * 1000)) {
                    badges.push({ emoji: '🔥', title: 'Hot (pushed this week)' });
                  }
                  // ⚡ High-activity — pushed in last 30 days with ≥3 stars
                  if (p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() < 30 * 24 * 60 * 60 * 1000) && p.stargazersCount >= 3) {
                    badges.push({ emoji: '⚡', title: 'High-activity' });
                  }
                  // 🌟 Most-starred — top 3 by stars
                  const top3Starred = [...projects].sort((a, b) => b.stargazersCount - a.stargazersCount).slice(0, 3);
                  if (top3Starred.some(s => s.id === p.id) && p.stargazersCount > 0) {
                    badges.push({ emoji: '🌟', title: 'Most-starred' });
                  }
                  // 🛡️ Deep-analyzed
                  if (isDeepAnalyzed) badges.push({ emoji: '🛡️', title: 'Deep-analyzed' });

                  // Show up to 2 badges max, positioned at top-right
                  return badges.slice(0, 2).map((badge, idx) => (
                    <g key={`badge-${idx}`} className="pointer-events-none">
                      <circle
                        cx={node.x + node.radius * 0.5 + idx * 10}
                        cy={node.y - node.radius * 0.7}
                        r={5}
                        fill="rgba(10,10,10,0.85)"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={node.x + node.radius * 0.5 + idx * 10}
                        y={node.y - node.radius * 0.7 + 1}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={7}
                        className="select-none"
                      >
                        {badge.emoji}
                      </text>
                    </g>
                  ));
                })()}
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

          {/* Minimap viewport + nodes */}
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
                {/* Minimap nodes — slightly larger */}
                {nodes.map(node => {
                  const mx = offsetX + node.x * scale;
                  const my = offsetY + node.y * scale;
                  const mr = Math.max(2, node.radius * scale * 0.6);
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
                {/* Viewport outline with glow */}
                <rect
                  x={vpX}
                  y={vpY}
                  width={vpW}
                  height={vpH}
                  fill="none"
                  stroke="rgba(16,185,129,0.4)"
                  strokeWidth={1}
                  rx={1}
                  filter="url(#minimapGlow)"
                />
                <rect
                  x={vpX}
                  y={vpY}
                  width={vpW}
                  height={vpH}
                  fill="none"
                  stroke="rgba(16,185,129,0.6)"
                  strokeWidth={0.5}
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

      {/* Edge tooltip on hover */}
      {hoveredEdgeInfo && (
        <div
          className="absolute z-30 pointer-events-none px-2.5 py-1.5 rounded-md text-[10px] shadow-lg border border-border/30"
          style={{
            left: hoveredEdgeInfo.x + 10,
            top: hoveredEdgeInfo.y - 20,
            background: 'rgba(10,10,10,0.92)',
            color: '#e2e8f0',
            maxWidth: 250,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {hoveredEdgeInfo.label}
        </div>
      )}

      {/* Connections panel — shown when clicking a node with connections */}
      {connectionsPanel && (
        <div
          className="absolute bottom-3 right-3 z-20 w-56 rounded-lg border border-border/20 shadow-xl overflow-hidden"
          style={{ background: 'rgba(10,10,10,0.92)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/10">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              Connections ({connectionsPanel.connections.length})
            </span>
            <button
              onClick={() => setConnectionsPanel(null)}
              className="text-muted-foreground/40 hover:text-foreground/60 transition-colors"
              title="Close connections panel"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {connectionsPanel.connections.map((conn, i) => {
              const isDep = conn.edgeType === 'dependency';
              return (
                <button
                  key={i}
                  onClick={() => {
                    const p = projects.find(pr => pr.id === conn.nodeId);
                    if (p) setSelectedProject(p);
                    setConnectionsPanel(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/10 transition-colors flex items-center gap-2 group"
                  title={`Click to view ${conn.projectName}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDep ? 'bg-blue-400' : 'bg-emerald-400'}`}
                  />
                  <span className="text-[10px] text-foreground/70 group-hover:text-foreground truncate flex-1">
                    {conn.projectName}
                  </span>
                  <span className="text-[8px] text-muted-foreground/30">
                    {conn.sharedItems.length} shared
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset View button */}
      <button
        onClick={handleResetView}
        className="absolute bottom-12 left-3 p-1.5 rounded-md bg-card/60 backdrop-blur-sm border border-border/20 text-muted-foreground/40 hover:text-foreground/60 hover:bg-card/80 transition-colors"
        title="Reset View"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="absolute z-50 min-w-[160px] rounded-lg border border-border/30 bg-card/95 backdrop-blur-md shadow-xl py-1 text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleContextAction('github', contextMenu.nodeId)}
            className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/10 text-foreground/70 hover:text-emerald-400 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-3 h-3" /> Open in GitHub
          </button>
          <button
            onClick={() => handleContextAction('analyze', contextMenu.nodeId)}
            className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/10 text-foreground/70 hover:text-emerald-400 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-3 h-3" /> Deep Analyze
          </button>
          <button
            onClick={() => handleContextAction('bookmark', contextMenu.nodeId)}
            className="w-full text-left px-3 py-1.5 hover:bg-amber-500/10 text-foreground/70 hover:text-amber-400 transition-colors flex items-center gap-2"
          >
            <Bookmark className="w-3 h-3" /> Bookmark
          </button>
          <div className="h-px bg-border/20 my-1" />
          <button
            onClick={() => handleContextAction('details', contextMenu.nodeId)}
            className="w-full text-left px-3 py-1.5 hover:bg-card/60 text-foreground/70 hover:text-foreground/90 transition-colors flex items-center gap-2"
          >
            <FileText className="w-3 h-3" /> View Details
          </button>
        </div>
      )}

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
