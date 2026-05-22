'use client';

import { Project, CATEGORY_COLORS } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import { Sparkles, Loader2, RefreshCw, Copy, Check, ExternalLink, Package, Lightbulb, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Recommendation {
  name: string;
  description: string;
  rationale: string;
  techStack: string[];
  relatedProjects: string[];
  gapFilled: string;
}

interface AIRecommendationsProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  username: string;
  onProjectClick: (project: Project) => void;
}

const TECH_COLORS: Record<string, string> = {
  // Languages
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Ruby: '#701516',
  Dart: '#00B4AB',
  C: '#555555',
  'C++': '#f34b7d',
  Java: '#b07219',
  // Frameworks
  'Next.js': '#808080',
  React: '#61dafb',
  Vue: '#4fc08d',
  Svelte: '#ff3e00',
  Tailwind: '#06b6d4',
  Express: '#808080',
  FastAPI: '#009688',
  Flask: '#808080',
  Django: '#092e20',
  Prisma: '#2d3748',
  tRPC: '#398ccb',
  Astro: '#ff5d01',
  Nuxt: '#00dc82',
  Docker: '#2496ed',
  Kubernetes: '#326ce5',
  Terraform: '#7b42bc',
  Flutter: '#02569b',
  'React Native': '#61dafb',
  Electron: '#47848f',
  'OpenAI SDK': '#412991',
  'Anthropic SDK': '#d4a574',
  LangChain: '#1c3c3c',
  Pydantic: '#e92063',
};

function getTechColor(tech: string): string {
  return TECH_COLORS[tech] || '#64748b';
}

export function AIRecommendations({ open, onClose, projects, username, onProjectClick }: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/github/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get recommendations');
      }

      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setHasLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to get recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [username, isLoading]);

  // Auto-fetch on first open
  const handleOpen = useCallback(() => {
    if (!hasLoaded && !isLoading) {
      fetchRecommendations();
    }
  }, [hasLoaded, isLoading, fetchRecommendations]);

  // Trigger on open
  if (open && !hasLoaded && !isLoading && recommendations.length === 0) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => handleOpen(), 0);
  }

  const copyBrief = useCallback((rec: Recommendation, idx: number) => {
    const brief = `# ${rec.name}\n\n${rec.description}\n\n## Why Build This\n${rec.rationale}\n\n## Tech Stack\n${rec.techStack.join(', ')}\n\n## Gap Filled\n${rec.gapFilled}\n\n## Related Existing Projects\n${rec.relatedProjects.join(', ')}`;
    navigator.clipboard.writeText(brief).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  }, []);

  // Find project by name
  const findProject = useCallback((name: string) => {
    return projects.find(p => p.name.toLowerCase() === name.toLowerCase());
  }, [projects]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-3xl max-h-[85vh] bg-card/95 backdrop-blur-xl border border-border/30 rounded-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="AI Recommendations"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border/20 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/15">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">AI Recommendations</h2>
                  <p className="text-[11px] text-muted-foreground/50">
                    LLM-powered suggestions based on your portfolio gaps
                  </p>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {!isLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRecommendations}
                    className="h-7 gap-1 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all"
                    title="Regenerate recommendations"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </Button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                {/* Loading skeleton */}
                {isLoading && (
                  <div className="space-y-4">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="rounded-xl border border-border/15 bg-card/40 p-5 animate-pulse">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10" />
                          <div className="flex-1">
                            <div className="h-4 bg-muted/20 rounded w-40 mb-1" />
                            <div className="h-3 bg-muted/10 rounded w-24" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-muted/10 rounded w-full" />
                          <div className="h-3 bg-muted/10 rounded w-3/4" />
                        </div>
                        <div className="flex gap-1.5 mt-3">
                          <div className="h-5 w-16 rounded bg-muted/10" />
                          <div className="h-5 w-20 rounded bg-muted/10" />
                          <div className="h-5 w-14 rounded bg-muted/10" />
                        </div>
                      </div>
                    ))}
                    <div className="text-center py-2">
                      <span className="text-sm text-amber-400/60 flex items-center justify-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        Analyzing your portfolio and generating recommendations...
                      </span>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="text-center py-8">
                    <p className="text-sm text-red-400 mb-3">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchRecommendations}
                      className="text-xs"
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                {/* Recommendations */}
                {!isLoading && !error && recommendations.length > 0 && (
                  <div className="space-y-4">
                    {recommendations.map((rec, idx) => (
                      <motion.div
                        key={rec.name}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.08 }}
                        className="rounded-xl border border-border/15 bg-card/40 hover:bg-card/60 hover:border-border/30 transition-all duration-200 overflow-hidden group"
                      >
                        <div className="p-5">
                          {/* Title row */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 shrink-0 mt-0.5">
                              <Lightbulb className="w-4 h-4 text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-semibold text-foreground">{rec.name}</h3>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20 shrink-0">
                                  {rec.gapFilled}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground/70 leading-relaxed">
                                {rec.description}
                              </p>
                            </div>
                          </div>

                          {/* Rationale */}
                          <div className="ml-11 mb-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                            <p className="text-[11px] text-amber-400/70 leading-relaxed">
                              <span className="font-medium text-amber-400/90">Why: </span>
                              {rec.rationale}
                            </p>
                          </div>

                          {/* Tech stack badges */}
                          <div className="ml-11 mb-3">
                            <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mr-2">Tech Stack</span>
                            <div className="inline-flex flex-wrap gap-1.5">
                              {rec.techStack.map(tech => (
                                <span
                                  key={tech}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border"
                                  style={{
                                    backgroundColor: getTechColor(tech) + '15',
                                    borderColor: getTechColor(tech) + '30',
                                    color: getTechColor(tech),
                                  }}
                                >
                                  <Package className="w-2.5 h-2.5" />
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Related projects */}
                          {rec.relatedProjects.length > 0 && (
                            <div className="ml-11 flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-muted-foreground/40">Similar to:</span>
                              {rec.relatedProjects.map(name => {
                                const relatedProject = findProject(name);
                                const color = relatedProject?.category
                                  ? CATEGORY_COLORS[relatedProject.category] || '#64748b'
                                  : '#64748b';
                                return (
                                  <button
                                    key={name}
                                    onClick={() => {
                                      if (relatedProject) {
                                        onProjectClick(relatedProject);
                                        onClose();
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border border-border/20 hover:border-border/40 bg-card/40 hover:bg-card/60 transition-all"
                                    style={relatedProject ? { color } : {}}
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    {name}
                                    {relatedProject ? '' : ' (not found)'}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Build this button */}
                          <div className="ml-11 mt-3 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyBrief(rec, idx)}
                              className="h-7 gap-1.5 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all"
                            >
                              {copiedIdx === idx ? (
                                <><Check className="w-3 h-3" /> Copied!</>
                              ) : (
                                <><Copy className="w-3 h-3" /> Build This</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!isLoading && !error && hasLoaded && recommendations.length === 0 && (
                  <div className="text-center py-12">
                    <Sparkles className="w-8 h-8 text-amber-400/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground/60">No recommendations generated. Try regenerating.</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border/10 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-muted-foreground/30">
                Powered by AI · Cached for 1 hour · {projects.length} projects analyzed
              </span>
              <span className="text-[10px] text-muted-foreground/20">
                Suggestions are AI-generated — verify before building
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
