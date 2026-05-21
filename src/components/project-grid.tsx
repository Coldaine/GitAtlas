'use client';

import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { useAtlasStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Star, GitFork, ExternalLink, Clock, Microscope, Cpu, Package, ShieldCheck, AlertTriangle, Archive, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

interface ProjectGridProps {
  projects: Project[];
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const { setSelectedProject } = useAtlasStore();

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No projects match your filters
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {projects.map((project, i) => (
          <ProjectCard key={project.id} project={project} index={i} onClick={() => setSelectedProject(project)} />
        ))}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  index: number;
  onClick: () => void;
}

function ProjectCard({ project, index, onClick }: ProjectCardProps) {
  const catColor = project.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';

  // Activity status
  const daysSincePush = project.pushedAt
    ? (Date.now() - new Date(project.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const activityStatus = daysSincePush < 7 ? 'hot' : daysSincePush < 30 ? 'warm' : daysSincePush < 180 ? 'cool' : 'cold';

  // Dependency count
  const depCount = project.dependencies
    ? (project.dependencies.runtime?.length || 0) + (project.dependencies.dev?.length || 0)
    : 0;

  // Framework count
  const fwCount = project.codeSignature?.frameworks?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className={`cursor-pointer transition-all duration-200 overflow-hidden group relative ${
          project.deepAnalyzedAt
            ? 'border-emerald-500/20 bg-card/50 hover:border-emerald-500/40 hover:bg-card/70'
            : 'border-border/20 bg-card/40 hover:bg-card/60 hover:border-border/40'
        }`}
        onClick={onClick}
      >
        {/* Top accent line — colored by category */}
        <div className="h-0.5 w-full" style={{ backgroundColor: catColor, opacity: 0.6 }} />

        {/* Gradient overlay on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ background: `linear-gradient(to top, ${catColor}08, transparent 40%)` }}
        />

        {/* Animated chevron indicator on hover */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
          <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
        </div>

        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-2 mb-2">
            <div className="relative mt-1 shrink-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ backgroundColor: catColor + '15', color: catColor }}
              >
                {project.category === 'tool' ? '⚙' :
                 project.category === 'library' ? '📚' :
                 project.category === 'application' ? '🖥' :
                 project.category === 'experiment' ? '🧪' :
                 project.category === 'template' ? '📋' :
                 project.category === 'config' ? '🔧' : '●'}
              </div>
              {/* Deep analysis badge with glow */}
              {project.deepAnalyzedAt && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-card shadow-[0_0_6px_rgba(16,185,129,0.4)] animate-pulse" style={{ animationDuration: '3s' }}>
                  <ShieldCheck className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-foreground transition-colors">
                  {project.name}
                </h3>
                {project.isArchived && (
                  <Archive className="w-3 h-3 text-orange-400/60 shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/40 truncate">
                {project.fullName}
              </p>
            </div>
          </div>

          {/* Summary — prefer deep summary if available */}
          {project.deepSummary ? (
            <p className="text-xs text-foreground/75 mb-2 line-clamp-2 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 rounded px-2 py-1.5">
              {project.deepSummary.slice(0, 150)}{project.deepSummary.length > 150 ? '...' : ''}
            </p>
          ) : project.summary ? (
            <p className="text-xs text-muted-foreground/80 mb-2 line-clamp-2 leading-relaxed">
              {project.summary}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/40 mb-2 line-clamp-2 italic">
              {project.description || 'No description'}
            </p>
          )}

          {/* Code signature badges — frameworks/patterns */}
          {(fwCount > 0 || project.codeSignature?.patterns?.length) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {project.codeSignature!.frameworks.slice(0, 3).map((fw) => (
                <span
                  key={fw}
                  className="text-[9px] px-1.5 py-0 rounded-sm bg-emerald-500/10 text-emerald-400/70 border border-emerald-500/10"
                >
                  {fw}
                </span>
              ))}
              {project.codeSignature!.patterns.slice(0, 2).map((pat) => (
                <span
                  key={pat}
                  className="text-[9px] px-1.5 py-0 rounded-sm bg-amber-500/10 text-amber-400/60"
                >
                  {pat}
                </span>
              ))}
              {(project.codeSignature!.frameworks.length + project.codeSignature!.patterns.length > 5) && (
                <span className="text-[9px] text-muted-foreground/30">+{project.codeSignature!.frameworks.length + project.codeSignature!.patterns.length - 5}</span>
              )}
            </div>
          )}

          {/* Tags row */}
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {project.tags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/20"
                >
                  {tag}
                </Badge>
              ))}
              {project.tags.length > 4 && (
                <span className="text-[10px] text-muted-foreground/40">+{project.tags.length - 4}</span>
              )}
            </div>
          )}

          {/* Bottom meta row */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 pt-1 border-t border-border/10">
            {project.language && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
                {project.language}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-400/60" /> {project.stargazersCount}
            </span>
            <span className="flex items-center gap-0.5">
              <GitFork className="w-3 h-3" /> {project.forksCount}
            </span>
            {depCount > 0 && (
              <span className="flex items-center gap-0.5 text-blue-400/50">
                <Package className="w-3 h-3" /> {depCount}
              </span>
            )}
            {project.pushedAt && (
              <span className={`flex items-center gap-0.5 ml-auto ${
                activityStatus === 'hot' ? 'text-red-400/60' :
                activityStatus === 'warm' ? 'text-amber-400/60' :
                activityStatus === 'cool' ? 'text-emerald-400/40' : 'text-muted-foreground/30'
              }`}>
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(project.pushedAt), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Category pill */}
          {project.category && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: catColor + '15', color: catColor }}
              >
                {project.category}
              </span>
              {project.deepAnalyzedAt && (
                <span className="text-[9px] text-emerald-400/50 flex items-center gap-0.5">
                  <Microscope className="w-2.5 h-2.5" /> Verified
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
