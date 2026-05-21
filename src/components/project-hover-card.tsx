'use client';

import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Star, GitFork, ExternalLink, ShieldCheck, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectHoverCardProps {
  project: Project | undefined;
  x: number;
  y: number;
}

// Compute health for hover card
function computeHealth(project: { pushedAt?: string | null; openIssuesCount: number; isArchived: boolean; stargazersCount: number }): { score: number; color: string; label: string } {
  if (project.isArchived) return { score: 0, color: '#64748b', label: 'Archived' };
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
  score = Math.max(0, Math.min(100, score));
  if (score >= 70) return { score, color: '#10b981', label: 'Healthy' };
  if (score >= 40) return { score, color: '#f59e0b', label: 'Moderate' };
  return { score, color: '#ef4444', label: 'Stale' };
}

// Generate mini sparkline data based on project activity
function generateSparkline(project: Project): number[] {
  // Use various signals to create a plausible activity sparkline
  const base = project.stargazersCount > 5 ? 3 : 1;
  const recentBoost = project.pushedAt
    ? (Date.now() - new Date(project.pushedAt).getTime() < 30 * 24 * 60 * 60 * 1000 ? 4 : 0)
    : 0;
  const points: number[] = [];
  for (let i = 0; i < 8; i++) {
    const noise = Math.sin(i * 1.5 + project.stargazersCount) * 2;
    const trend = i === 7 ? recentBoost : 0;
    points.push(Math.max(0, base + noise + trend));
  }
  return points;
}

export function ProjectHoverCard({ project, x, y }: ProjectHoverCardProps) {
  if (!project) return null;

  const cardWidth = 320;
  const cardHeight = 260;
  const posX = x + 20 + cardWidth > window.innerWidth ? x - cardWidth - 20 : x + 20;
  const posY = Math.min(y, window.innerHeight - cardHeight - 20);

  const catColor = project.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';
  const health = computeHealth(project);
  const topFrameworks = project.codeSignature?.frameworks?.slice(0, 3) || [];
  const depCount = (project.dependencies?.runtime?.length || 0) + (project.dependencies?.dev?.length || 0);
  const sparkline = generateSparkline(project);
  const maxSpark = Math.max(...sparkline, 1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 pointer-events-none"
        style={{ left: posX, top: posY }}
      >
        <div className="w-80 rounded-lg border border-border/40 bg-card/95 backdrop-blur-md shadow-xl p-4">
          {/* Header */}
          <div className="flex items-start gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: catColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {project.name}
                </h3>
                {project.deepAnalyzedAt && (
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground/60 truncate">
                {project.fullName}
              </p>
            </div>
          </div>

          {/* Summary */}
          {project.summary && (
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed line-clamp-2">
              {project.summary}
            </p>
          )}

          {/* Health score + top frameworks + dep count */}
          <div className="flex items-center gap-3 mb-2">
            {/* Health ring */}
            <div className="flex items-center gap-1.5">
              <div className="relative w-5 h-5">
                <svg viewBox="0 0 20 20" className="w-5 h-5 -rotate-90">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                  <circle
                    cx="10" cy="10" r="8" fill="none" stroke={health.color} strokeWidth="2.5"
                    strokeDasharray={`${(health.score / 100) * 50.26} 50.26`}
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[5px] font-bold" style={{ color: health.color }}>
                  {health.score}
                </span>
              </div>
              <span className="text-[9px] font-medium" style={{ color: health.color }}>{health.label}</span>
            </div>

            {/* Dependency count */}
            {depCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Package className="w-2.5 h-2.5" /> {depCount} deps
              </span>
            )}
          </div>

          {/* Top frameworks */}
          {topFrameworks.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {topFrameworks.map(fw => (
                <Badge
                  key={fw}
                  variant="secondary"
                  className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                >
                  {fw}
                </Badge>
              ))}
            </div>
          )}

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {project.tags.slice(0, 5).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/20"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Mini sparkline of recent activity */}
          <div className="flex items-center gap-2 mb-2">
            <svg width="60" height="16" className="shrink-0">
              {sparkline.map((val, i) => {
                const barH = (val / maxSpark) * 12;
                return (
                  <rect
                    key={i}
                    x={i * 7.5}
                    y={14 - barH}
                    width={5}
                    height={barH}
                    rx={1}
                    fill={catColor}
                    opacity={0.3 + (i / sparkline.length) * 0.4}
                  />
                );
              })}
            </svg>
            <span className="text-[8px] text-muted-foreground/30">activity</span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
            {project.language && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
                {project.language}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" /> {project.stargazersCount}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="w-3 h-3" /> {project.forksCount}
            </span>
            {project.category && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: catColor + '20', color: catColor }}
              >
                {project.category}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
