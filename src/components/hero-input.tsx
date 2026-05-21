'use client';

import { useState, useCallback } from 'react';
import { useAtlasStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Rocket, Github, Sparkles } from 'lucide-react';

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
      // Step 1: Fetch repos
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

        // Step 2: Start analysis
        setAnalyzing(true);
        setAnalyzeProgress('Analyzing projects with AI...');

        // Fire and forget the analysis — poll for results
        fetch('/api/github/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: fetchData.jobId }),
        }).then(async (analyzeRes) => {
          if (analyzeRes.ok) {
            setAnalyzeProgress('Analysis complete!');
            // Refresh projects with analysis data
            const projectsRes = await fetch(`/api/github/projects?username=${user}`);
            if (projectsRes.ok) {
              const projectsData = await projectsRes.json();
              setProjects(projectsData.projects || []);
              if (projectsData.analysisJob) {
                setAnalysisJob(projectsData.analysisJob);
              }
            }
          }
          setAnalyzing(false);
        }).catch(() => {
          setAnalyzing(false);
          setAnalyzeProgress('Analysis failed — you can retry later');
        });

        // Poll for intermediate results every 5s
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/github/status?jobId=${fetchData.jobId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.job) {
              setAnalysisJob(statusData.job);
              setAnalyzeProgress(`Analyzed ${statusData.job.processedRepos}/${statusData.job.totalRepos} projects`);
              if (statusData.job.status === 'completed') {
                clearInterval(pollInterval);
                // Refresh projects
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
    <div className="w-full max-w-2xl mx-auto px-6 text-center">
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10"
      >
        {/* Logo/Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
        >
          <Sparkles className="w-10 h-10 text-emerald-400" />
        </motion.div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
          <span className="bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
            Git Atlas
          </span>
        </h1>

        <p className="text-lg text-muted-foreground mb-2 max-w-md mx-auto">
          Explore your project universe
        </p>
        <p className="text-sm text-muted-foreground/60 mb-10 max-w-lg mx-auto">
          See what you have. Find what you forgot. Never start from zero again.
        </p>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <div className="relative flex-1">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExplore()}
              placeholder="GitHub username"
              className="pl-10 h-12 bg-card/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/50 focus:ring-emerald-500/20"
            />
          </div>
          <Button
            onClick={handleExplore}
            className="h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-2"
          >
            <Rocket className="w-4 h-4" />
            Explore
          </Button>
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-destructive text-sm mt-4"
          >
            {error}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
