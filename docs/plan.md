# Git Atlas — Build Plan

## Themes
- **Visual first**: Spatial graphs, not lists. Hover-to-discover, not scroll-to-find.
- **Purpose over tech**: Tags like "automation", "template", "experiment" — not just "TypeScript", "Python"
- **Everything in one place**: Personal repos + org repos, unified view
- **AI-augmented**: Auto-generated summaries and semantic tags from repo data + README

## Architecture

### Backend (API Routes)
- `POST /api/github/fetch` — Given a username, fetch all public repos (personal + orgs) via GitHub REST API
- `POST /api/github/analyze` — Send repo metadata + README to LLM, get back summary + semantic tags
- `GET /api/github/status` — Check loading/progress of analysis

### Frontend (Single Page)
1. **Landing**: Username input → "Explore" button
2. **Graph View** (default): Force-directed SVG graph. Nodes = projects, edges = shared tags. Size by stars/activity. Color by category.
3. **Card Grid View**: Rich project cards with tags, summary, language badges
4. **Tag Sidebar**: Interactive tag cloud/filter — click a tag, see only related projects
5. **Search**: Fuzzy search across all project data
6. **Detail Panel**: Slide-out panel when clicking a project — full summary, all tags, links, README preview

### Data Flow
1. User enters GitHub username
2. Backend fetches all repos via GitHub API (no auth needed for public)
3. For each repo, LLM generates: summary (1-2 sentences), semantic tags, category
4. Results cached in SQLite via Prisma
5. Frontend renders interactive visualization

## Tech Stack
- Next.js 16 + TypeScript
- Tailwind CSS + shadcn/ui (cards, badges, tooltips, hover cards, dialogs)
- Framer Motion (animations, transitions)
- Recharts (for any charts)
- SVG + custom physics (force-directed graph)
- Prisma + SQLite (caching)
- z-ai-web-dev-sdk (LLM for summaries/tags)
- GitHub REST API (no auth for public repos)

## Key UX Decisions
- **Graph is the hero**: The force-directed graph is the primary view. It's what makes this *visual*.
- **Hover cards everywhere**: Hover a node → see summary + tags. No clicking required for basic info.
- **Tag connections visible**: Lines between projects that share tags make relationships obvious.
- **Smooth animations**: Framer Motion for everything — layout, transitions, hover states.
- **Dark mode friendly**: The graph especially shines on dark backgrounds.

## Execution Order
1. Prisma schema + DB setup
2. Backend API routes (GitHub fetch + LLM analyze)
3. Frontend: Username input + loading states
4. Frontend: Card grid view (simpler, get data flowing)
5. Frontend: Force-directed graph view
6. Frontend: Tag filtering + search
7. Frontend: Detail panel
8. Polish: animations, responsiveness, error handling
