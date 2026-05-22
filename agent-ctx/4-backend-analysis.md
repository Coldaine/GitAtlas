# Task 4 — Backend + Analysis Improvements

## Work Log

### 1. CommitActivityCache Prisma Model
- Added `CommitActivityCache` model to `prisma/schema.prisma`
- Fields: `id`, `username` (unique), `activityJson`, `totalCommits`, `activeDays`, `fetchedAt`
- Ran `bun run db:push` — schema synced successfully

### 2. Commit Activity API Endpoint
- Created `/src/app/api/github/commit-activity/route.ts` (GET)
- Accepts `?username=Coldaine` query param
- For each repo belonging to the user, fetches last 100 commits from GitHub API (`/repos/{owner}/{repo}/commits?per_page=100`)
- Aggregates commits by date across all repos for last 365 days
- Returns `{ activity: [{ date, count, repos }], totalCommits, activeDays, cached }`
- Caches results in `CommitActivityCache` table — if cache < 1 hour old, returns cached data
- Batch fetches (5 repos at a time) with 500ms delays to respect rate limits

### 3. Org Repos API Endpoint
- Created `/src/app/api/github/org-repos/route.ts` (GET)
- Accepts `?org=ProjectBroadside` query param
- Fetches `GET /orgs/{org}/repos?per_page=100&type=all` with pagination
- For each repo, fetches README content (batch of 8)
- Upserts into Project table with `ownerType='Organization'`
- Returns same format as existing projects API (with deep field deserialization)
- Returns `{ projects, totalRepos, org }`

### 4. Progressive Deep Analysis
- Modified `/src/app/api/github/deep-analyze/route.ts`:
  - Added `?progress=true` query param support on POST
  - When `progress=true`, the `handleProgressiveAnalysis()` function analyzes ONE repo at a time
  - Accepts `repoIndex` in body (0-based index into unanalyzed repos list)
  - Clamps `repoIndex` to valid range
  - Returns `{ result: { id, name, status }, total: N, completed: M, nextIndex: M }`
  - Extracted `analyzeProject()` helper shared by both batch and progressive modes
  - Original batch mode behavior is fully preserved (no breaking changes)

### 5. Verification
- `bun run db:push` — database synced, Prisma Client regenerated
- `bun run lint` — 0 errors, clean pass

## Files Changed
- `prisma/schema.prisma` — Added CommitActivityCache model
- `src/app/api/github/commit-activity/route.ts` — New file
- `src/app/api/github/org-repos/route.ts` — New file
- `src/app/api/github/deep-analyze/route.ts` — Modified (progressive analysis support)
