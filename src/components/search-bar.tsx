'use client';

import { useState, useCallback } from 'react';
import { useAtlasStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useAtlasStore();
  const [localValue, setLocalValue] = useState(searchQuery);

  const handleChange = useCallback(
    (value: string) => {
      setLocalValue(value);
      // Debounce
      const timer = setTimeout(() => setSearchQuery(value), 200);
      return () => clearTimeout(timer);
    },
    [setSearchQuery]
  );

  return (
    <div className="relative w-48">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
      <Input
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search projects..."
        className="h-8 pl-8 text-xs bg-card/30 border-border/30 placeholder:text-muted-foreground/40 focus:border-emerald-500/40 focus:ring-emerald-500/10"
      />
    </div>
  );
}
