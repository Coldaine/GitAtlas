'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAtlasStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Rocket, Github, Sparkles } from 'lucide-react';

// Floating particles for the hero background
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: { x: number; y: number; vx: number; vy: number; r: number; opacity: number; color: string }[] = [];
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.3 + 0.05,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      }

      // Draw connections between close particles
      ctx.globalAlpha = 0.03;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

export function HeroInput() {
  const [inputValue, setInputValue] = useState('Coldaine');
  const { setUsername, setProjects, setAnalysisJob, setLoading, setAnalyzing, setFetchProgress, setAnalyzeProgress } = useAtlasStore();
  const [error, setError] = useState<string | null>(null);

  const handleExplore = useCallback(async () => {
    if (!inputValue.trim()) return;
    const user = inputValue.trim();
    setUsername(user);
    setError(null);
    setLoading(true);
    setFetchProgress('Fetching repositories...');

    try {
      const fetchRes = await fetch('/api/github/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user }),
      });

      if (!fetchRes.ok) {
        const err = await fetchRes.json();
        throw new Error(err.error || 'Failed to fetch repos');
      }

      const fetchData = await fetchRes.json();
      setProjects(fetchData.projects || []);
      setFetchProgress(`Fetched ${fetchData.totalRepos} repositories`);

      if (fetchData.jobId) {
        const job = {
          id: fetchData.jobId,
          username: user,
          status: 'pending' as const,
          totalRepos: fetchData.totalRepos,
          processedRepos: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setAnalysisJob(job);

        setAnalyzing(true);
        setAnalyzeProgress('Analyzing projects with AI...');

        fetch('/api/github/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: fetchData.jobId }),
        }).then(async (analyzeRes) => {
          if (analyzeRes.ok) {
            setAnalyzeProgress('Analysis complete!');
            const projectsRes = await fetch(`/api/github/projects?username=${user}`);
            if (projectsRes.ok) {
              const projectsData = await projectsRes.json();
              setProjects(projectsData.projects || []);
              if (projectsData.analysisJob) setAnalysisJob(projectsData.analysisJob);
            }
          }
          setAnalyzing(false);
        }).catch(() => {
          setAnalyzing(false);
          setAnalyzeProgress('Analysis failed — you can retry later');
        });

        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/github/status?jobId=${fetchData.jobId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.job) {
              setAnalysisJob(statusData.job);
              setAnalyzeProgress(`Analyzed ${statusData.job.processedRepos}/${statusData.job.totalRepos} projects`);
              if (statusData.job.status === 'completed') {
                clearInterval(pollInterval);
                const projectsRes = await fetch(`/api/github/projects?username=${user}`);
                if (projectsRes.ok) {
                  const projectsData = await projectsRes.json();
                  setProjects(projectsData.projects || []);
                }
              }
            }
          }
        }, 5000);
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  }, [inputValue, setUsername, setProjects, setAnalysisJob, setLoading, setAnalyzing, setFetchProgress, setAnalyzeProgress]);

  return (
    <div className="w-full max-w-2xl mx-auto px-6 text-center relative">
      {/* Animated particle background */}
      <ParticleField />

      {/* Gradient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/5 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-rose-500/3 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          className="mb-8 inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-amber-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/10"
        >
          <Sparkles className="w-12 h-12 text-emerald-400" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-6xl sm:text-7xl font-bold tracking-tight mb-4"
        >
          <span className="bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradient_3s_ease-in-out_infinite]">
            Git Atlas
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xl text-foreground/80 mb-2 max-w-md mx-auto font-light"
        >
          Explore your project universe
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm text-muted-foreground/60 mb-12 max-w-lg mx-auto"
        >
          See what you have. Find what you forgot. Never start from zero again.
        </motion.p>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <div className="relative flex-1 group">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-emerald-400 transition-colors" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExplore()}
              placeholder="GitHub username"
              className="pl-10 h-14 bg-card/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-base transition-all group-focus-within:shadow-lg group-focus-within:shadow-emerald-500/5"
            />
          </div>
          <Button
            onClick={handleExplore}
            className="h-14 px-10 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Rocket className="w-5 h-5" />
            Explore
          </Button>
        </motion.div>

        {/* Feature hints */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground/30"
        >
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
            Visual graph
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/40" />
            AI summaries
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500/40" />
            Smart search
          </span>
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-destructive text-sm mt-4"
          >
            {error}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
