#!/usr/bin/env node

const apiBase = (
  process.env.BENCHMARK_API_URL || 'https://hisaby-api.onrender.com/api'
).replace(/\/$/, '');
const iterations = Math.min(
  Math.max(Number(process.env.BENCHMARK_ITERATIONS) || 5, 3),
  20,
);

async function resolveToken() {
  if (process.env.BENCHMARK_ACCESS_TOKEN) {
    return process.env.BENCHMARK_ACCESS_TOKEN;
  }
  const email = process.env.BENCHMARK_EMAIL;
  const password = process.env.BENCHMARK_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set BENCHMARK_ACCESS_TOKEN or BENCHMARK_EMAIL and BENCHMARK_PASSWORD.',
    );
  }
  const response = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Login failed with HTTP ${response.status}.`);
  }
  if (body.requires2fa) {
    throw new Error(
      'Benchmark account requires 2FA; provide BENCHMARK_ACCESS_TOKEN instead.',
    );
  }
  if (!body.accessToken) {
    throw new Error('Login response did not contain an access token.');
  }
  return body.accessToken;
}

function percentile(sorted, p) {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

async function measureEndpoint(token, path) {
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(`${apiBase}${path}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.arrayBuffer();
    samples.push({
      iteration: index + 1,
      status: response.status,
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      bytes: body.byteLength,
    });
    if (response.status >= 500) process.exitCode = 1;
  }
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  return {
    path,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    maxMs: durations[durations.length - 1],
    statuses: [...new Set(samples.map((sample) => sample.status))],
    bytes: Math.max(...samples.map((sample) => sample.bytes)),
    samples,
  };
}

const endpoints = [
  '/dashboard/stats',
  '/invoices?summary=true&take=50',
  '/journal?take=100',
  '/products/stats',
  '/vat/stats',
  '/resto/reports/live',
  '/resto/reports/summary?days=7',
  '/pos/catalog/sync',
  '/pos/stats/today',
  '/pos/shifts/current',
];

try {
  const token = await resolveToken();
  const results = [];
  for (const endpoint of endpoints) {
    results.push(await measureEndpoint(token, endpoint));
  }
  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        apiBase,
        iterations,
        results,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
