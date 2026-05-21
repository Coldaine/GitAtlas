'use client';

import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { useAtlasStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Star, GitFork, ExternalLink, Clock } from 'lucide-react';
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
    <div className="flex-1 overflow-y-auto p-4">
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className="cursor-pointer border-border/20 bg-card/40 hover:bg-card/60 hover:border-border/40 transition-all duration-200 overflow-hidden"
        onClick={onClick}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start gap-2 mb-2">
            <div
              className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ring-2 ring-offset-1 ring-offset-card"
              style={{ backgroundColor: catColor, ringColor: catColor + '40' }}
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {project.name}
              </h3>
              <p className="text-[10px] text-muted-foreground/50 truncate">
                {project.fullName}
              </p>
            </div>
          </div>

          {/* Summary */}
          {project.summary ? (
            <p className="text-xs text-muted-foreground/80 mb-3 line-clamp-2 leading-relaxed">
              {project.summary}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/40 mb-3 line-clamp-2 italic">
              {project.description || 'No description'}
            </p>
          )}

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
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

          {/* Meta row */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            {project.language && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
                {project.language}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3" /> {project.stargazersCount}
            </span>
            <span className="flex items-center gap-0.5">
              <GitFork className="w-3 h-3" /> {project.forksCount}
            </span>
            {project.pushedAt && (
              <span className="flex items-center gap-0.5 ml-auto">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(project.pushedAt), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Category pill */}
          {project.category && (
            <div className="mt-2">
              <span
                className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: catColor + '15', color: catColor }}
              >
                {project.category}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
