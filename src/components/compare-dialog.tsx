'use client';

import { useState, useMemo } from 'react';
import { useAtlasStore } from '@/lib/store';
import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { GitCompare, Star, GitFork, Clock, Package, Cpu, ShieldCheck, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompareDialog({ open, onOpenChange }: CompareDialogProps) {
  const { projects, setSelectedProject, setDetailOpen } = useAtlasStore();
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  const left = projects.find(p => p.id === leftId);
  const right = projects.find(p => p.id === rightId);

  // Shared deps
  const sharedDeps = useMemo(() => {
    if (!left?.dependencies || !right?.dependencies) return [];
    const leftAll = [...(left.dependencies.runtime || []), ...(left.dependencies.dev || [])];
    const rightAll = [...(right.dependencies.runtime || []), ...(right.dependencies.dev || [])];
    return leftAll.filter(d => rightAll.includes(d));
  }, [left, right]);

  // Shared tags
  const sharedTags = useMemo(() => {
    if (!left || !right) return [];
    return [...left.tags, ...left.topics].filter(t => [...right.tags, ...right.topics].includes(t));
  }, [left, right]);

  // Unique tags
  const leftOnlyTags = useMemo(() => {
    if (!left || !right) return [];
    return [...left.tags, ...left.topics].filter(t => ![...right.tags, ...right.topics].includes(t));
  }, [left, right]);

  const rightOnlyTags = useMemo(() => {
    if (!left || !right) return [];
    return [...right.tags, ...right.topics].filter(t => ![...left.tags, ...left.topics].includes(t));
  }, [left, right]);

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setDetailOpen(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] bg-card/95 backdrop-blur-md border-border/30 max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-emerald-400" />
            Compare Projects
          </DialogTitle>
          <DialogDescription>
            Select two projects to see side-by-side comparison
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* Left selector */}
          <div>
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1 block">Project A</label>
            <select
              value={leftId || ''}
              onChange={e => setLeftId(e.target.value || null)}
              className="w-full h-8 text-xs bg-background/30 border border-border/20 rounded-md px-2 text-foreground/80"
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {/* Right selector */}
          <div>
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1 block">Project B</label>
            <select
              value={rightId || ''}
              onChange={e => setRightId(e.target.value || null)}
              className="w-full h-8 text-xs bg-background/30 border border-border/20 rounded-md px-2 text-foreground/80"
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {left && right && (
          <ScrollArea className="max-h-[55vh] mt-3">
            <div className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { p: left, label: 'A' },
                  { p: right, label: 'B' },
                ].map(({ p, label }) => {
                  const catColor = p.category ? CATEGORY_COLORS[p.category] : '#64748b';
                  return (
                    <button
                      key={label}
                      onClick={() => handleProjectClick(p)}
                      className="text-left p-3 rounded-lg border border-border/20 bg-background/30 hover:bg-background/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
                          style={{ backgroundColor: catColor + '15', color: catColor }}
                        >
                          {p.category === 'tool' ? '⚙' : p.category === 'library' ? '📚' : p.category === 'application' ? '🖥' : p.category === 'experiment' ? '🧪' : '●'}
                        </span>
                        <span className="text-sm font-semibold truncate">{p.name}</span>
                        {p.deepAnalyzedAt && <ShieldCheck className="w-3 h-3 text-emerald-400/50" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 truncate">{p.fullName}</p>
                    </button>
                  );
                })}
              </div>

              {/* Stats comparison */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { p: left, label: 'A' },
                  { p: right, label: 'B' },
                ].map(({ p, label }) => (
                  <div key={label} className="space-y-1.5 p-3 rounded-lg bg-background/20 border border-border/10">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400/60" /> {p.stargazersCount} stars</span>
                      <span className="flex items-center gap-1"><GitFork className="w-3 h-3" /> {p.forksCount} forks</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                      {p.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LANGUAGE_COLORS[p.language] || '#8b8b8b' }} />
                          {p.language}
                        </span>
                      )}
                      <span className={p.category ? '' : 'text-muted-foreground/30'}>
                        {p.category || 'uncategorized'}
                      </span>
                    </div>
                    {p.pushedAt && (
                      <div className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last push {formatDistanceToNow(new Date(p.pushedAt), { addSuffix: true })}
                      </div>
                    )}
                    {p.dependencies && (
                      <div className="text-[10px] text-blue-400/50 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {(p.dependencies.runtime?.length || 0) + (p.dependencies.dev?.length || 0)} deps
                      </div>
                    )}
                    {p.codeSignature && (
                      <div className="flex flex-wrap gap-1">
                        {p.codeSignature.frameworks.slice(0, 3).map(fw => (
                          <span key={fw} className="text-[9px] px-1 rounded-sm bg-emerald-500/10 text-emerald-400/60">{fw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Shared vs unique tags */}
              {(sharedTags.length > 0 || leftOnlyTags.length > 0 || rightOnlyTags.length > 0) && (
                <div className="space-y-2">
                  {sharedTags.length > 0 && (
                    <div>
                      <h4 className="text-[10px] text-emerald-400/60 uppercase tracking-wider mb-1">Shared Tags ({sharedTags.length})</h4>
                      <div className="flex flex-wrap gap-1">
                        {sharedTags.map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] text-amber-400/50 uppercase tracking-wider mb-1">Only A ({leftOnlyTags.length})</h4>
                      <div className="flex flex-wrap gap-1">
                        {leftOnlyTags.slice(0, 8).map(t => (
                          <Badge key={t} variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-border/20">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] text-amber-400/50 uppercase tracking-wider mb-1">Only B ({rightOnlyTags.length})</h4>
                      <div className="flex flex-wrap gap-1">
                        {rightOnlyTags.slice(0, 8).map(t => (
                          <Badge key={t} variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-border/20">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Shared dependencies */}
              {sharedDeps.length > 0 && (
                <div>
                  <h4 className="text-[10px] text-blue-400/60 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Package className="w-2.5 h-2.5" /> Shared Dependencies ({sharedDeps.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {sharedDeps.slice(0, 15).map(d => (
                      <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-400 border-blue-500/20">{d}</Badge>
                    ))}
                    {sharedDeps.length > 15 && (
                      <span className="text-[10px] text-muted-foreground/30">+{sharedDeps.length - 15} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Summary comparison */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { p: left, label: 'A' },
                  { p: right, label: 'B' },
                ].map(({ p, label }) => (
                  <div key={label}>
                    <h4 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-1">{label} Summary</h4>
                    <p className="text-[11px] text-foreground/70 leading-relaxed bg-background/20 rounded-lg p-2 border border-border/10">
                      {p.deepSummary || p.summary || p.description || 'No summary available'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
