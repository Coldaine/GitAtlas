'use client';

import { useAtlasStore } from '@/lib/store';
import { Project } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TagSidebarProps {
  projects: Project[];
}

export function TagSidebar({ projects }: TagSidebarProps) {
  const { activeTags, toggleTag, setActiveTags } = useAtlasStore();

  // Collect all tags with counts
  const tagCounts = new Map<string, number>();
  projects.forEach((p) => {
    [...p.tags, ...p.topics].forEach((t) => {
      if (t) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    });
  });

  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Categories
  const categoryCounts = new Map<string, number>();
  projects.forEach((p) => {
    if (p.category) {
      categoryCounts.set(p.category, (categoryCounts.get(p.category) || 0) + 1);
    }
  });
  const sortedCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="w-56 shrink-0 border-r border-border/20 bg-card/20 flex flex-col">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/10">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filters</span>
        {activeTags.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTags([])}
            className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Categories */}
          {sortedCategories.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
                Categories
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {sortedCategories.map(([cat, count]) => (
                  <motion.div key={cat} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Badge
                      variant={activeTags.includes(cat) ? 'default' : 'secondary'}
                      className={`cursor-pointer text-xs px-2 py-0.5 ${
                        activeTags.includes(cat)
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'hover:bg-card/80'
                      }`}
                      onClick={() => toggleTag(cat)}
                    >
                      {cat} <span className="ml-1 opacity-60">{count}</span>
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {sortedTags.map(([tag, count]) => (
                  <motion.div
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Badge
                      variant={activeTags.includes(tag) ? 'default' : 'outline'}
                      className={`cursor-pointer text-xs px-2 py-0.5 transition-colors ${
                        activeTags.includes(tag)
                          ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                          : 'border-border/30 hover:border-border/60 hover:bg-card/50'
                      }`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag} <span className="ml-1 opacity-50">{count}</span>
                    </Badge>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
