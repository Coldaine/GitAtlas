'use client';

import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';

interface LoadingOverlayProps {
  progress: string;
}

export function LoadingOverlay({ progress }: LoadingOverlayProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-12 h-12 text-emerald-400" />
          </motion.div>
          <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1" />
        </div>
        <div className="text-center">
          <p className="text-sm text-foreground font-medium">{progress}</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment...</p>
        </div>
      </motion.div>
    </div>
  );
}
