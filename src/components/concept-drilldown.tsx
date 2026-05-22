'use client';

import { useAtlasStore } from '@/lib/store';
import { Project, CATEGORY_COLORS } from '@/lib/types';
import { matchesConceptGroup, CONCEPT_GROUPS } from '@/components/concept-groups';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';

interface ConceptDrilldownProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MiniNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  project: Project;
  radius: number;
  color: string;
}

export function ConceptDrilldown({ isOpen, onClose }: ConceptDrilldownProps) {
  const { projects, activeConceptGroups, setSelectedProject } = useAtlasStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [miniNodes, setMiniNodes] = useState<MiniNode[]>([]);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<MiniNode[]>([]);

  // Filter projects by active concept groups
  const filteredProjects = useMemo(() => {
    if (activeConceptGroups.length === 0) return [];
    return projects.filter(p =>
      activeConceptGroups.some(groupId => {
        const group = CONCEPT_GROUPS.find(g => g.id === groupId);
        if (!group) return false;
        return matchesConceptGroup(p, group);
      })
    );
  }, [projects, activeConceptGroups]);

  // Compute connections between filtered projects
  const connections = useMemo(() => {
    const conns: { source: string; target: string; shared: string[] }[] = [];
    for (let i = 0; i < filteredProjects.length; i++) {
      for (let j = i + 1; j < filteredProjects.length; j++) {
        const a = filteredProjects[i];
        const b = filteredProjects[j];
        const aTags = new Set([...a.tags, ...a.topics, a.language].filter(Boolean));
        const bTags = new Set([...b.tags, ...b.topics, b.language].filter(Boolean));
        const shared = [...aTags].filter(t => bTags.has(t));
        if (shared.length >= 1) {
          conns.push({ source: a.id, target: b.id, shared });
        }
      }
    }
    return conns;
  }, [filteredProjects]);

  const width = isExpanded ? 500 : 360;
  const height = isExpanded ? 350 : 240;

  // Initialize and run mini force simulation
  useEffect(() => {
    if (filteredProjects.length === 0) return;
    const cx = width / 2;
    const cy = height / 2;

    nodesRef.current = filteredProjects.map((p, i) => {
      const angle = (i / filteredProjects.length) * Math.PI * 2;
      const spread = Math.min(width, height) * 0.3;
      return {
        id: p.id,
        x: cx + Math.cos(angle) * spread * (0.5 + Math.random() * 0.5),
        y: cy + Math.sin(angle) * spread * (0.5 + Math.random() * 0.5),
        vx: 0,
        vy: 0,
        project: p,
        radius: 8 + Math.min(p.stargazersCount * 2, 12),
        color: p.category ? CATEGORY_COLORS[p.category] || '#64748b' : '#64748b',
      };
    });

    // Initial render
    setMiniNodes([...nodesRef.current]);

    const simulate = () => {
      const ns = nodesRef.current;
      const damping = 0.85;

      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x;
          const dy = ns[i].y - ns[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1500 / (dist * dist + 100);
          ns[i].vx += (dx / dist) * force;
          ns[i].vy += (dy / dist) * force;
          ns[j].vx -= (dx / dist) * force;
          ns[j].vy -= (dy / dist) * force;
        }
      }

      for (const node of ns) {
        node.vx += (cx - node.x) * 0.005;
        node.vy += (cy - node.y) * 0.005;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
      }

      // Update state for render
      setMiniNodes([...ns]);
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animRef.current);
  }, [filteredProjects, width, height]);

  if (!isOpen || filteredProjects.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-3 right-3 z-30 rounded-lg bg-card/90 backdrop-blur-xl border border-border/25 shadow-2xl overflow-hidden"
        style={{ width: isExpanded ? 520 : 380 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/15 bg-card/50">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔍</span>
            <h3 className="text-[11px] font-medium text-foreground/80">
              Drill Down: {filteredProjects.length} projects
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded text-muted-foreground/30 hover:text-foreground/60 transition-colors"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground/30 hover:text-foreground/60 transition-colors"
              title="Close drill-down view"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Mini graph */}
        <svg
          width={width}
          height={height}
          className="w-full"
        >
          {/* Edges */}
          {connections.map((conn, i) => {
            const sourceNode = miniNodes.find(n => n.id === conn.source);
            const targetNode = miniNodes.find(n => n.id === conn.target);
            if (!sourceNode || !targetNode) return null;
            return (
              <line
                key={`conn-${i}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke="#ffffff"
                strokeWidth={0.5}
                opacity={0.15}
              />
            );
          })}

          {/* Nodes */}
          {miniNodes.map(node => (
            <g
              key={node.id}
              onClick={() => setSelectedProject(node.project)}
              className="cursor-pointer"
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={node.color}
                opacity={0.6}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1}
              />
              <text
                x={node.x}
                y={node.y + node.radius + 11}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={7}
                className="pointer-events-none select-none"
              >
                {node.project.name.length > 14 ? node.project.name.slice(0, 12) + '…' : node.project.name}
              </text>
            </g>
          ))}
        </svg>

        {/* Project cards strip */}
        <div className="border-t border-border/15 bg-card/30 p-2">
          <div className="flex gap-2 overflow-x-auto max-h-28 pb-1">
            {filteredProjects.slice(0, 8).map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className="shrink-0 w-28 p-2 rounded-md bg-card/40 border border-border/10 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all text-left"
              >
                <div className="text-[10px] font-medium text-foreground/70 truncate">{p.name}</div>
                <div className="text-[8px] text-muted-foreground/40 truncate">{p.language || '—'}</div>
                {p.stargazersCount > 0 && (
                  <div className="text-[8px] text-amber-400/60 mt-0.5">★ {p.stargazersCount}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
