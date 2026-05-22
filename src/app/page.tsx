'use client';

import { useEffect } from 'react';
import { useAtlasStore } from '@/lib/store';
import { CockpitDashboard } from '@/components/cockpit-dashboard';

export default function Home() {
  const { username, isLoading, isDataLoaded, setProjects, setAnalysisJob, setLoading, setAnalyzing, setFetchProgress, setAnalyzeProgress, setDataLoaded } = useAtlasStore();

  // Auto-load data immediately on mount
  useEffect(() => {
    if (isDataLoaded) return;

    async function loadData() {
      setLoading(true);
      setFetchProgress('Loading your project universe...');

      try {
        // Try loading from DB first (already fetched)
        const existingRes = await fetch(`/api/github/projects?username=${username}`);
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          if (existingData.projects && existingData.projects.length > 0) {
            setProjects(existingData.projects);
            if (existingData.analysisJob) setAnalysisJob(existingData.analysisJob);
            setLoading(false);
            setDataLoaded(true);
            // If not all analyzed, trigger analysis
            const unanalyzed = existingData.projects.filter((p: any) => !p.summary).length;
            if (unanalyzed > 0) {
              triggerAnalysis(existingData.analysisJob?.id);
            }
            return;
          }
        }

        // No cached data — fetch from GitHub
        const fetchRes = await fetch('/api/github/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });

        if (!fetchRes.ok) {
          setLoading(false);
          return;
        }

        const fetchData = await fetchRes.json();
        setProjects(fetchData.projects || []);
        setFetchProgress(`Loaded ${fetchData.totalRepos} projects`);

        if (fetchData.jobId) {
          setAnalysisJob({
            id: fetchData.jobId,
            username,
            status: 'pending' as const,
            totalRepos: fetchData.totalRepos,
            processedRepos: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Start analysis in background
          triggerAnalysis(fetchData.jobId);
        }

        setLoading(false);
        setDataLoaded(true);
      } catch (err) {
        console.error('Load error:', err);
        setLoading(false);
      }
    }

    async function triggerAnalysis(jobId?: string) {
      if (!jobId) return;
      setAnalyzing(true);
      setAnalyzeProgress('AI analyzing projects...');

      // Fire analysis
      fetch('/api/github/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      }).then(async (res) => {
        if (res.ok) {
          setAnalyzeProgress('Analysis complete!');
          // Refresh
          const projectsRes = await fetch(`/api/github/projects?username=${username}`);
          if (projectsRes.ok) {
            const projectsData = await projectsRes.json();
            setProjects(projectsData.projects || []);
            if (projectsData.analysisJob) setAnalysisJob(projectsData.analysisJob);
          }
        }
        setAnalyzing(false);
      }).catch(() => {
        setAnalyzing(false);
      });

      // Poll for progress
      const poll = setInterval(async () => {
        const statusRes = await fetch(`/api/github/status?jobId=${jobId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.job) {
            setAnalysisJob(statusData.job);
            setAnalyzeProgress(`Analyzed ${statusData.job.processedRepos}/${statusData.job.totalRepos}`);
            if (statusData.job.status === 'completed') {
              clearInterval(poll);
              const projectsRes = await fetch(`/api/github/projects?username=${username}`);
              if (projectsRes.ok) {
                const projectsData = await projectsRes.json();
                setProjects(projectsData.projects || []);
              }
            }
          }
        }
      }, 4000);
    }

    loadData();
  }, [username, isDataLoaded]);

  return (
    <main className="h-screen flex flex-col bg-background overflow-hidden">
      <CockpitDashboard />
    </main>
  );
}
