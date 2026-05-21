'use client';

import { useAtlasStore } from '@/lib/store';
import { CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Star,
  GitFork,
  ExternalLink,
  Globe,
  Code2,
  GitBranch,
  AlertCircle,
  Clock,
  Archive,
  Tag,
  Layers,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow, format } from 'date-fns';

export function DetailPanel() {
  const { selectedProject, setSelectedProject, detailOpen, setDetailOpen } = useAtlasStore();

  if (!selectedProject) return null;

  const project = selectedProject;
  const catColor = project.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';

  return (
    <Sheet open={detailOpen} onOpenChange={(open) => {
      setDetailOpen(open);
      if (!open) setSelectedProject(null);
    }}>
      <SheetContent className="w-[480px] sm:max-w-[480px] bg-card/95 backdrop-blur-md border-border/30 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/20">
          <div className="flex items-start gap-3">
            <div
              className="w-4 h-4 rounded-full mt-1 shrink-0"
              style={{ backgroundColor: catColor }}
            />
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold truncate">
                {project.name}
              </SheetTitle>
              <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                {project.fullName}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              onClick={() => window.open(project.htmlUrl, '_blank')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              GitHub
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-120px)]">
          <div className="px-6 py-4 space-y-5">
            {/* Summary */}
            {project.summary && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                  AI Summary
                </h4>
                <p className="text-sm text-foreground/90 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 rounded-md p-3">
                  {project.summary}
                </p>
              </div>
            )}

            {/* Description */}
            {project.description && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                  Description
                </h4>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {project.description}
                </p>
              </div>
            )}

            {/* Category */}
            {project.category && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Category
                </h4>
                <span
                  className="inline-block text-sm px-3 py-1 rounded-full font-medium"
                  style={{ backgroundColor: catColor + '15', color: catColor }}
                >
                  {project.category}
                </span>
              </div>
            )}

            {/* Tags */}
            {project.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border-amber-500/20"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Topics */}
            {project.topics.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                  GitHub Topics
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {project.topics.map((topic) => (
                    <Badge
                      key={topic}
                      variant="outline"
                      className="text-xs px-2 py-0.5 border-border/30"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator className="bg-border/20" />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {project.language && (
                <StatItem
                  icon={<span className="w-3 h-3 rounded-full" style={{ backgroundColor: langColor }} />}
                  label="Language"
                  value={project.language}
                />
              )}
              <StatItem
                icon={<Star className="w-3.5 h-3.5 text-amber-400" />}
                label="Stars"
                value={String(project.stargazersCount)}
              />
              <StatItem
                icon={<GitFork className="w-3.5 h-3.5 text-blue-400" />}
                label="Forks"
                value={String(project.forksCount)}
              />
              <StatItem
                icon={<AlertCircle className="w-3.5 h-3.5 text-orange-400" />}
                label="Open Issues"
                value={String(project.openIssuesCount)}
              />
              <StatItem
                icon={<GitBranch className="w-3.5 h-3.5 text-emerald-400" />}
                label="Branch"
                value={project.defaultBranch}
              />
              <StatItem
                icon={<Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                label="Last Push"
                value={project.pushedAt
                  ? formatDistanceToNow(new Date(project.pushedAt), { addSuffix: true })
                  : 'Never'}
              />
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {project.isFork && (
                <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                  Fork
                </Badge>
              )}
              {project.isArchived && (
                <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                  <Archive className="w-3 h-3 mr-1" /> Archived
                </Badge>
              )}
              <Badge variant="outline" className="text-xs border-border/30">
                {project.visibility}
              </Badge>
              <Badge variant="outline" className="text-xs border-border/30">
                {project.ownerType}
              </Badge>
            </div>

            {/* Homepage */}
            {project.homepage && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Homepage
                </h4>
                <a
                  href={project.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                  {project.homepage}
                </a>
              </div>
            )}

            <Separator className="bg-border/20" />

            {/* README */}
            {project.readmeContent && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Code2 className="w-3 h-3" /> README
                </h4>
                <div className="text-xs text-foreground/70 leading-relaxed bg-background/50 rounded-md p-4 border border-border/10 max-h-96 overflow-y-auto prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{project.readmeContent.slice(0, 3000)}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="text-[10px] text-muted-foreground/30 space-y-0.5">
              <p>Created: {format(new Date(project.githubCreatedAt), 'MMM d, yyyy')}</p>
              <p>Updated: {format(new Date(project.githubUpdatedAt), 'MMM d, yyyy')}</p>
              {project.analyzedAt && (
                <p>Analyzed: {format(new Date(project.analyzedAt), 'MMM d, yyyy h:mm a')}</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-background/30 rounded-md px-3 py-2">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground/50">{label}</p>
        <p className="text-xs font-medium text-foreground/80">{value}</p>
      </div>
    </div>
  );
}
