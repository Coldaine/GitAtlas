'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  targetId: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Your Project Universe',
    description: 'This graph shows all your repos as an interactive constellation. Drag nodes, zoom, and click to explore.',
    targetId: 'tour-graph-area',
    position: 'top',
  },
  {
    title: 'Deep Analysis',
    description: 'Click "Deep Analyze" to scan your repos with AI. It reads code, detects frameworks, and generates accurate summaries.',
    targetId: 'tour-deep-analyze',
    position: 'bottom',
  },
  {
    title: 'Smart Search',
    description: 'Ask "Do I have a CLI tool for X?" and find repos you forgot you had. Powered by AI matching.',
    targetId: 'tour-smart-search',
    position: 'bottom',
  },
  {
    title: 'Explore Details',
    description: 'Click any project to see deep analysis, file trees, dependencies, similar projects, and more.',
    targetId: 'tour-detail-panel',
    position: 'left',
  },
];

const STORAGE_KEY = 'git-atlas-tour-completed';

export function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = not started
  const [isVisible, setIsVisible] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check if tour should show
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Small delay so the page can render first
      const timer = setTimeout(() => {
        setCurrentStep(0);
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update spotlight position when step changes — use rAF to avoid sync setState in effect
  useEffect(() => {
    if (currentStep < 0 || currentStep >= TOUR_STEPS.length) return;

    const raf = requestAnimationFrame(() => {
      const step = TOUR_STEPS[currentStep];
      const target = document.getElementById(step.targetId);

      if (target) {
        const rect = target.getBoundingClientRect();
        setSpotlightRect(rect);

        const padding = 16;
        let x = 0;
        let y = 0;

        switch (step.position) {
          case 'bottom':
            x = rect.left + rect.width / 2;
            y = rect.bottom + padding;
            break;
          case 'top':
            x = rect.left + rect.width / 2;
            y = rect.top - padding;
            break;
          case 'left':
            x = rect.left - padding;
            y = rect.top + rect.height / 2;
            break;
          case 'right':
            x = rect.right + padding;
            y = rect.top + rect.height / 2;
            break;
        }

        setTooltipPos({ x, y });
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    setIsVisible(false);
    setCurrentStep(-1);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  if (!isVisible || currentStep < 0) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] pointer-events-none"
          onClick={(e) => { if (e.target === e.currentTarget) handleSkip(); }}
        >
          {/* Dark overlay */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {spotlightRect && (
                  <rect
                    x={spotlightRect.left - 6}
                    y={spotlightRect.top - 6}
                    width={spotlightRect.width + 12}
                    height={spotlightRect.height + 12}
                    rx={8}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.6)"
              mask="url(#spotlight-mask)"
            />
            {/* Spotlight border */}
            {spotlightRect && (
              <rect
                x={spotlightRect.left - 6}
                y={spotlightRect.top - 6}
                width={spotlightRect.width + 12}
                height={spotlightRect.height + 12}
                rx={8}
                fill="none"
                stroke="rgba(16,185,129,0.5)"
                strokeWidth={2}
              />
            )}
          </svg>

          {/* Tooltip card */}
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute pointer-events-auto"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: step.position === 'top' || step.position === 'bottom'
                ? 'translateX(-50%)'
                : step.position === 'left'
                  ? 'translateX(-100%) translateY(-50%)'
                  : 'translateY(-50%)',
            }}
          >
            <div
              className="bg-card/95 backdrop-blur-md border border-emerald-500/20 rounded-lg p-4 shadow-xl max-w-xs pointer-events-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-foreground/90">{step.title}</h3>
                <button
                  onClick={handleSkip}
                  className="text-muted-foreground/40 hover:text-foreground/60 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground/70 leading-relaxed mb-3">
                {step.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground/30">
                  {currentStep + 1} of {TOUR_STEPS.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleSkip}
                    className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors"
                  >
                    Skip
                  </button>
                  <Button
                    size="sm"
                    className="h-6 gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3"
                    onClick={handleNext}
                  >
                    {currentStep < TOUR_STEPS.length - 1 ? 'Next' : 'Got it!'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
