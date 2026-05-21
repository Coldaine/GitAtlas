'use client';

import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Star, GitFork, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectHoverCardProps {
  project: Project | undefined;
  x: number;
  y: number;
}

export function ProjectHoverCard({ project, x, y }: ProjectHoverCardProps) {
  if (!project) return null;

  // Position card so it doesn't go off screen
  const cardWidth = 320;
  const cardHeight = 200;
  const posX = x + 20 + cardWidth > window.innerWidth ? x - cardWidth - 20 : x + 20;
  const posY = Math.min(y, window.innerHeight - cardHeight - 20);

  const catColor = project.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';

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
              <h3 className="text-sm font-semibold text-foreground truncate">
                {project.name}
              </h3>
              <p className="text-xs text-muted-foreground/60 truncate">
                {project.fullName}
              </p>
            </div>
          </div>

          {/* Summary */}
          {project.summary && (
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
              {project.summary}
            </p>
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
