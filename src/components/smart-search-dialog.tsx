'use client';

import { useState, useCallback } from 'react';
import { Project } from '@/lib/types';
import { CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAtlasStore } from '@/lib/store';
import { Zap, Search, ExternalLink, Loader2, Star, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartSearchResult extends Project {
  relevanceScore: number;
  reason: string;
  howToUse: string;
}

interface SmartSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
}

export function SmartSearchDialog({ open, onOpenChange, username }: SmartSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SmartSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { setSelectedProject, setDetailOpen } = useAtlasStore();

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !username) return;
    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch('/api/github/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, query: query.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error('Smart search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [query, username]);

  const handleResultClick = useCallback((project: Project) => {
    setSelectedProject(project);
    setDetailOpen(true);
    onOpenChange(false);
  }, [setSelectedProject, setDetailOpen, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card/95 backdrop-blur-md border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Do I already have this?
          </DialogTitle>
          <DialogDescription>
            Describe what you need and I&apos;ll check your existing projects for matches
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. 'a tool for monitoring workflows' or 'voice input'"
              className="pl-10 bg-background/30 border-border/30 focus:border-amber-500/40 focus:ring-amber-500/10"
              autoFocus
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isLoading || !query.trim()}
            className="bg-amber-600 hover:bg-amber-500 text-white gap-1.5"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Find
          </Button>
        </div>

        <ScrollArea className="max-h-96 mt-2">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-12 gap-2 text-muted-foreground"
              >
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span className="text-sm">Searching your project universe...</span>
              </motion.div>
            ) : hasSearched && results.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                <p className="text-sm">No matching projects found.</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Maybe this is something new to build!</p>
              </motion.div>
            ) : results.length > 0 ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                {results.map((result, i) => {
                  const catColor = result.category ? CATEGORY_COLORS[result.category] : '#64748b';
                  const langColor = result.language ? LANGUAGE_COLORS[result.language] : '#8b8b8b';

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-3 rounded-lg border border-border/20 bg-background/30 hover:bg-background/50 cursor-pointer transition-colors"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Relevance score */}
                        <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: catColor + '15', color: catColor }}
                        >
                          {result.relevanceScore}%
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold truncate">{result.name}</h4>
                            {result.language && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
                                {result.language}
                              </span>
                            )}
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
                              <Star className="w-2.5 h-2.5" /> {result.stargazersCount}
                            </span>
                          </div>

                          {/* Reason */}
                          <p className="text-xs text-emerald-400/80 mb-1">
                            <ArrowRight className="w-3 h-3 inline mr-1" />
                            {result.reason}
                          </p>

                          {/* How to use */}
                          <p className="text-xs text-muted-foreground/60">
                            💡 {result.howToUse}
                          </p>

                          {/* Tags */}
                          {result.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {result.tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <ExternalLink className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-1" />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="prompt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <Zap className="w-8 h-8 text-amber-400/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground/60">Describe what you need in natural language</p>
                <p className="text-xs text-muted-foreground/30 mt-1">
                  Try: &quot;a knowledge graph tool&quot; or &quot;something for voice input&quot;
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
