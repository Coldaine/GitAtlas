// src/lib/github-token.ts
//
// Server-side GitHub credentials.
//
// Why this changed: the original file hardcoded a real PAT in source — that
// token is now considered compromised (it sat in a tarball you handed to an
// agent) and MUST be rotated. From now on the token is read from the
// `GITHUB_TOKEN` env var (see .env.example). We export a getter so changes
// in dev `.env` are picked up on the next request without a restart, and we
// build the headers lazily so unauthenticated reads of public repos still
// work if no token is configured (GitHub allows 60 req/hr unauth).

const USER_AGENT = 'GitAtlas';

export function getGithubToken(): string {
  return process.env.GITHUB_TOKEN ?? '';
}

export function getGithubHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': USER_AGENT,
    ...extra,
  };
  const token = getGithubToken();
  if (token) headers.Authorization = `token ${token}`;
  return headers;
}

// Back-compat exports so existing call sites keep working.
// These are evaluated at import time but routes are server-only and the env
// is loaded by Next before route modules execute, so the values are correct
// for the lifetime of the worker. New code should prefer `getGithubHeaders`
// when it needs to merge custom Accept headers (raw README fetch, etc.).
export const GITHUB_TOKEN = getGithubToken();
export const GITHUB_HEADERS: Record<string, string> = getGithubHeaders();
