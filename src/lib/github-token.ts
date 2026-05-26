// src/lib/github-token.ts
//
// Server-side GitHub credentials.
//
// Why this changed: the original file hardcoded a real PAT in source — that
// token is now considered compromised (it sat in a tarball you handed to an
// agent) and MUST be rotated. From now on the token is read from the
// `GITHUB_TOKEN` env var. We export a getter so changes
// to the environment are picked up when headers are built, and we
// build the headers lazily so unauthenticated reads of public repos still
// work if no token is configured.

const USER_AGENT = 'GitAtlas';

export function getGithubToken(): string {
  // Why Bearer: GitHub's REST API recommends Bearer for modern tokens
  // and it is more robust across different token types.
  return process.env.GITHUB_TOKEN ?? '';
}

export function getGithubHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': USER_AGENT,
    ...extra,
  };
  const token = getGithubToken();
  if (token) {
    // Why: Bearer tends to be more compatible than 'token' for newer PATs.
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// Back-compat exports so existing call sites keep working.
// Why evaluated at module load: current call sites assume these are strings.
// All PRs in this sequence are server-side Next.js routes, so process.env 
// is stable throughout the request lifecycle.
export const GITHUB_TOKEN = getGithubToken();
export const GITHUB_HEADERS: Record<string, string> = getGithubHeaders();
