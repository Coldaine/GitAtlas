'use client';

import { useAtlasStore } from '@/lib/store';
import { HeroInput } from '@/components/hero-input';
import { AtlasDashboard } from '@/components/atlas-dashboard';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { projects, isLoading } = useAtlasStore();
  const showDashboard = projects.length > 0 || isLoading;

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <AnimatePresence mode="wait">
        {!showDashboard ? (
          <motion.div
            key="hero"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex items-center justify-center"
          >
            <HeroInput />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <AtlasDashboard />
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="mt-auto py-3 px-6 text-center text-xs text-muted-foreground/50 border-t border-border/30">
        Git Atlas — Your Project Universe
      </footer>
    </main>
  );
}
