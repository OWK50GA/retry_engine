/**
 * Test script for the retry engine.
 *
 * Usage:
 *   npx tsx test-script.ts flaky        → fails 3 times, then succeeds
 *   npx tsx test-script.ts 404          → 4xx terminal, never retried
 *   npx tsx test-script.ts deadletter   → always 500, dead-lettered at maxRetries
 *
 * Make sure the retry engine is running: pnpm dev
 */

import http from "http";

const ENGINE = "http://localhost:3001";
const MOCK_PORT = 3002;
const MOCK_BASE = `http://localhost:${MOCK_PORT}`;

const scenario = process.argv[2];

const VALID_SCENARIOS = ["flaky", "404", "deadletter"];

if (!scenario || !VALID_SCENARIOS.includes(scenario)) {
  console.error(`\nUsage: npx tsx test-script.ts <scenario>`);
  console.error(`Scenarios: ${VALID_SCENARIOS.join(" | ")}\n`);
  process.exit(1);
}

// --- Mock server state ---
const hitCounts: Record<string, number> = {};

const mockServer = http.createServer((req, res) => {
  const url = req.url ?? "/";
  hitCounts[url] = (hitCounts[url] ?? 0) + 1;
  const count = hitCounts[url];

  if (url === "/flaky") {
    if (count <= 3) {
      console.log(`  [mock /flaky] hit #${count} → 500 (intentional failure)`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error (intentional)" }));
    } else {
      console.log(`  [mock /flaky] hit #${count} → 200 ✓ (success)`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Finally succeeded!", attempt: count }));
    }
    return;
  }

  if (url === "/always-404") {
    console.log(`  [mock /always-404] hit #${count} → 404`);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  if (url === "/always-500") {
    console.log(`  [mock /always-500] hit #${count} → 500`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Always failing" }));
    return;
  }

  res.writeHead(404);
  res.end("Unknown mock route");
});

// --- Helpers ---

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postRequest(payload: object) {
  const res = await fetch(`${ENGINE}/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(`POST /request failed: ${JSON.stringify(json)}`);
  return json.data as { id: string; status: string };
}

async function getRequest(id: string) {
  const res = await fetch(`${ENGINE}/requests/${id}`);
  const json = (await res.json()) as any;
  return json.data as any;
}

async function pollUntilDone(id: string, timeoutMs = 120000) {
  const start = Date.now();
  let lastStatus = "";

  while (Date.now() - start < timeoutMs) {
    const data = await getRequest(id);
    const status = data.status;

    if (status !== lastStatus) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  [poll] status: ${status.toUpperCase()} (${elapsed}s elapsed)`);
      lastStatus = status;
    }

    if (status === "completed" || status === "failed") {
      return data;
    }

    await sleep(800);
  }

  throw new Error(`Timed out waiting for request ${id}`);
}

function printAttempts(attempts: any[]) {
  if (!attempts || attempts.length === 0) {
    console.log("  No attempts recorded.");
    return;
  }

  console.log(`\n  Attempt history (${attempts.length} total):`);
  console.log("  " + "─".repeat(60));

  let prevTime: number | null = null;
  for (const a of attempts) {
    const waitLabel =
      prevTime !== null
        ? `waited ${((a.attempted_at - prevTime) / 1000).toFixed(2)}s`
        : "first attempt";
    const statusLabel = a.status_code ?? "network error";
    console.log(
      `  #${a.attempt_number}  status=${statusLabel}  duration=${a.duration_ms}ms  ${waitLabel}`
    );
    prevTime = a.attempted_at;
  }

  console.log("  " + "─".repeat(60));
}

// --- Scenarios ---

async function scenarioFlaky() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO: flaky — fails 3 times, then succeeds      ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("  Expects: 4 attempts, backoff doubling, final = completed\n");

  const { id } = await postRequest({
    url: `${MOCK_BASE}/flaky`,
    method: "GET",
    maxRetries: 5,
    backoffMs: 1000,
  });

  console.log(`  Request queued. ID: ${id}\n`);

  const result = await pollUntilDone(id);

  console.log(`\n  Final status : ${result.status.toUpperCase()}`);
  if (result.result) {
    console.log(`  Result       : ${result.result}`);
  }
  printAttempts(result.attempts);
}

async function scenario404() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO: 404 — terminal error, never retried       ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("  Expects: 1 attempt only, final = failed\n");

  const { id } = await postRequest({
    url: `${MOCK_BASE}/always-404`,
    method: "GET",
    maxRetries: 5,
    backoffMs: 1000,
  });

  console.log(`  Request queued. ID: ${id}\n`);

  const result = await pollUntilDone(id);

  console.log(`\n  Final status : ${result.status.toUpperCase()}`);
  console.log(`  Last error   : ${result.last_error}`);
  printAttempts(result.attempts);

  const verdict = result.attempts.length === 1 ? "✓ PASS" : "✗ FAIL";
  console.log(`\n  ${verdict} — expected 1 attempt, got ${result.attempts.length}`);
}

async function scenarioDeadletter() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  SCENARIO: deadletter — always 500, hits maxRetries  ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("  Expects: 3 attempts (maxRetries=3), final = failed\n");

  const { id } = await postRequest({
    url: `${MOCK_BASE}/always-500`,
    method: "GET",
    maxRetries: 3,
    backoffMs: 1000,
  });

  console.log(`  Request queued. ID: ${id}\n`);

  const result = await pollUntilDone(id);

  console.log(`\n  Final status : ${result.status.toUpperCase()}`);
  console.log(`  Last error   : ${result.last_error}`);
  printAttempts(result.attempts);

  const verdict = result.attempts.length === 3 ? "✓ PASS" : "✗ FAIL";
  console.log(`\n  ${verdict} — expected 3 attempts, got ${result.attempts.length}`);
}

// --- Main ---

async function main() {
  console.log(`\nStarting mock server on port ${MOCK_PORT}...`);
  await new Promise<void>((resolve) => mockServer.listen(MOCK_PORT, resolve));
  console.log(`Mock server ready. Running scenario: ${scenario}\n`);

  try {
    if (scenario === "flaky") await scenarioFlaky();
    else if (scenario === "404") await scenario404();
    else if (scenario === "deadletter") await scenarioDeadletter();

    console.log("\n  Done.\n");
  } catch (err) {
    console.error("\nError:", err);
  } finally {
    mockServer.close();
    process.exit(0);
  }
}

main();
