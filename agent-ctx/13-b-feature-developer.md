# Task 13-b: Tech Radar View + Bookmark Dashboard + Recent Commits API

## Agent: Feature Developer

## Work Completed

### Part 1: Tech Radar View (`/src/components/tech-radar.tsx`)
- Created SVG-based radar/spider chart with 8 axes:
  - Frontend, Backend, AI/LLM, CLI Tools, Data/Storage, Automation, Desktop, DevOps
- Each axis computes score from `project.codeSignature` (frameworks + patterns) and `project.tags` + `project.topics` + `project.language`
- SVG radar chart features:
  - 5 concentric grid circles
  - Axis lines from center to each endpoint
  - Filled data polygon with emerald-to-teal gradient
  - Glow filter on data polygon
  - Data points on each axis (expand on hover)
  - Category-colored dots on each axis label
  - Hover on axis shows contributing project list with reasons
- Legend showing score per dimension
- Gap Analysis section: identifies dimensions with 0-1 projects (weak areas)
  - Each gap shows "Consider building a project in this area" suggestion
  - Current contributing projects listed with click-through
  - "Strong coverage" message when all dimensions have ≥2 projects
- Responsive sizing via ResizeObserver
- Smooth framer-motion entrance animations

### Part 2: Bookmark Dashboard (`/src/components/bookmark-dashboard.tsx`)
- Reads bookmarks from localStorage key `git-atlas-bookmarks`
- Grid of larger, more detailed cards:
  - Health score ring (SVG)
  - Name with deep analysis shield icon
  - Language + category badges
  - Deep summary (in emerald box) or regular summary
  - Top 5 framework badges
  - Metadata row: stars, forks, dependency count, activity-colored last push time
  - Quick Actions: View Details, GitHub (opens in new tab), Remove Bookmark
- Sort options: By Name, By Health, By Last Push, By Stars (dropdown)
- Total stats bar at top: X bookmarked projects, average health score
- Friendly empty state with call-to-action when no bookmarks
- Export bookmarks as list (copies markdown to clipboard)
- Remove bookmark functionality (updates localStorage + UI)

### Part 3: Recent Commits API (`/src/app/api/github/recent-commits/route.ts`)
- GET endpoint: `/api/github/recent-commits?username=X&limit=30`
- Fetches last 10 commits per repo from GitHub API
- Returns sorted by date descending
- 10-minute cache via RecentCommitsCache Prisma model
- Batch fetching (5 repos at a time) with 300ms delays
- Returns: sha, message, author, date, repo name, repo full name, url

### Part 4: Integration into Cockpit Dashboard
- Updated `/src/lib/types.ts`: Added `'radar'` and `'bookmarks'` to ViewMode type
- Updated `/src/components/cockpit-dashboard.tsx`:
  - Imported TechRadar and BookmarkDashboard components
  - Added Target and Bookmark icons from lucide-react
  - Added ⌘6 shortcut for Tech Radar view
  - Added ⌘7 shortcut for Bookmarks view
  - Added Radar view toggle button (Target icon) in view mode selector
  - Added Bookmarks view toggle button (Bookmark icon, amber highlight) in view mode selector
  - Added TechRadar rendering in center area with AnimatePresence transitions
  - Added BookmarkDashboard rendering in center area with AnimatePresence transitions
  - Added ⌘6 and ⌘7 entries in keyboard shortcuts overlay

### Schema Changes
- Added `RecentCommitsCache` model to `prisma/schema.prisma`
- Ran `bun run db:push` to sync schema

### Lint
- All lint checks pass with 0 errors

## Files Modified
- `/src/lib/types.ts` — Added 'radar' | 'bookmarks' to ViewMode
- `/src/components/tech-radar.tsx` — NEW: SVG radar chart component
- `/src/components/bookmark-dashboard.tsx` — NEW: Bookmark dashboard component
- `/src/app/api/github/recent-commits/route.ts` — NEW: Recent commits API endpoint
- `/src/components/cockpit-dashboard.tsx` — Added new view modes, shortcuts, imports
- `/prisma/schema.prisma` — Added RecentCommitsCache model
