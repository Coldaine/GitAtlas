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
  Activity,
  Flame,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow, format } from 'date-fns';

export function DetailPanel() {
  const { selectedProject, setSelectedProject, detailOpen, setDetailOpen } = useAtlasStore();

  if (!selectedProject) return null;

  const project = selectedProject;
  const catColor = project.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';

  // Activity score
  const getActivityLevel = () => {
    if (!project.pushedAt) return { level: 'inactive', color: '#64748b', icon: Clock, text: 'No activity' };
    const daysSincePush = (Date.now() - new Date(project.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePush < 7) return { level: 'hot', color: '#ef4444', icon: Flame, text: 'Active this week' };
    if (daysSincePush < 30) return { level: 'warm', color: '#f59e0b', icon: Activity, text: 'Active this month' };
    if (daysSincePush < 180) return { level: 'cool', color: '#10b981', icon: Activity, text: 'Active within 6 months' };
    return { level: 'cold', color: '#64748b', icon: Clock, text: 'Inactive for 6+ months' };
  };

  const activity = getActivityLevel();
  const ActivityIcon = activity.icon;

  return (
    <Sheet open={detailOpen} onOpenChange={(open) => {
      setDetailOpen(open);
      if (!open) setSelectedProject(null);
    }}>
      <SheetContent className="w-[520px] sm:max-w-[520px] bg-card/95 backdrop-blur-md border-border/30 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/20">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl mt-0.5 shrink-0 flex items-center justify-center text-lg"
              style={{ backgroundColor: catColor + '20', color: catColor }}
            >
              {project.category === 'tool' ? '⚙' :
               project.category === 'library' ? '📚' :
               project.category === 'application' ? '🖥' :
               project.category === 'experiment' ? '🧪' :
               project.category === 'template' ? '📋' :
               project.category === 'config' ? '🔧' : '●'}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-bold truncate">
                {project.name}
              </SheetTitle>
              <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                {project.fullName}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => window.open(project.htmlUrl, '_blank')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              GitHub
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-120px)]">
          <div className="px-6 py-5 space-y-5">
            {/* Activity indicator */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/30 border border-border/10">
              <ActivityIcon className="w-4 h-4" style={{ color: activity.color }} />
              <span className="text-xs font-medium" style={{ color: activity.color }}>{activity.text}</span>
              {project.openIssuesCount > 0 && (
                <span className="text-[10px] text-muted-foreground/40 ml-auto">
                  {project.openIssuesCount} open issues
                </span>
              )}
            </div>

            {/* Summary */}
            {project.summary && (
              <div>
                <h4 className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  AI Summary
                </h4>
                <p className="text-sm text-foreground/90 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3.5">
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
                  className="inline-block text-sm px-3.5 py-1.5 rounded-lg font-medium border"
                  style={{ backgroundColor: catColor + '10', color: catColor, borderColor: catColor + '20' }}
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
                      className="text-xs px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
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
            <div className="grid grid-cols-2 gap-2.5">
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
                  className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
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
                <div className="text-xs text-foreground/70 leading-relaxed bg-background/50 rounded-lg p-4 border border-border/10 max-h-96 overflow-y-auto prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{project.readmeContent.slice(0, 3000)}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="text-[10px] text-muted-foreground/30 space-y-0.5 pt-2">
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
    <div className="flex items-center gap-2.5 bg-background/30 rounded-lg px-3 py-2.5 border border-border/5">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-medium text-foreground/80">{value}</p>
      </div>
    </div>
  );
}
