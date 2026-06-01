import db from "./db";
import { JobRequest, RequestStatusEnum } from "./types";

const getDueRequests = db.prepare(`
    SELECT * FROM requests
    WHERE status IN ('pending', 'retrying')    
    AND (next_retry_at IS NULL OR next_retry_at <= ?)
    LIMIT 10
`);

const claimRequest = db.prepare(`
    UPDATE requests
    SET status = 'retrying',
        next_retry_at = @nextRetryAt,
        updated_at = @now
    WHERE id = @id
`);

const updateRequest = db.prepare(`
    UPDATE requests
    SET status = @status,
        attempt_count = @attemptCount,
        next_retry_at = @nextRetryAt,
        last_error = @lastError,
        result = @result,
        updated_at = @now
    WHERE id = @id
`);

const insertAttempt = db.prepare(`
    INSERT INTO attempts (request_id, attempt_number, status_code, error, duration_ms, attempted_at)
    VALUES (@requestId, @attemptNumber, @statusCode, @error, @durationMs, @attemptedAt)
`);

async function runWorker() {
  const due: JobRequest[] = getDueRequests.all(Date.now()) as JobRequest[];

  if (due.length > 0) {
    console.log(`[worker] woke up - ${due.length} due request(s)`);
    await Promise.all(due.map(makeRequest));
  }
}

async function makeRequest(request: JobRequest) {
  const claimNextRetryAt = calculateNextRetry(
    request.backoff_ms,
    request.attempt_count,
  );

  claimRequest.run({
    id: request.id,
    nextRetryAt: claimNextRetryAt,
    now: Date.now(),
  });

  console.log(
    `[worker] attempting request ${request.id} (attempt #${request.attempt_count + 1} of ${request.max_retries}) → ${request.method} ${request.url}`,
  );

  const start = Date.now();
  try {
    const res = await fetch(request.url, {
      method: request.method,
      ...(request.body && { body: request.body }),
    });

    const durationMs = Date.now() - start;
    const newAttemptCount = request.attempt_count + 1;

    if (res.ok) {
      const data = await res.json();
      console.log(
        `[worker] ✓ ${request.id} completed (${res.status}) in ${durationMs}ms`,
      );
      updateRequest.run({
        id: request.id,
        status: RequestStatusEnum.COMPLETED,
        attemptCount: newAttemptCount,
        nextRetryAt: null,
        lastError: null,
        result: JSON.stringify(data),
        now: Date.now(),
      });

      insertAttempt.run({
        requestId: request.id,
        attemptNumber: newAttemptCount,
        statusCode: res.status,
        error: null,
        durationMs,
        attemptedAt: start,
      });
    } else {
      const err = await res.text();
      const postponeNextRetryAt = calculateNextRetry(
        request.backoff_ms,
        newAttemptCount,
      );

      insertAttempt.run({
        requestId: request.id,
        attemptNumber: newAttemptCount,
        statusCode: res.status,
        error: err,
        durationMs,
        attemptedAt: start,
      });

      if (newAttemptCount >= request.max_retries || !shouldRetry(res.status)) {
        console.log(
          `[worker] ✗ ${request.id} failed permanently (${res.status}) — ${!shouldRetry(res.status) ? "non-retryable status" : "max retries reached"}`,
        );
        return updateRequest.run({
          id: request.id,
          status: RequestStatusEnum.FAILED,
          attemptCount: newAttemptCount,
          nextRetryAt: null,
          lastError: err,
          result: null,
          now: Date.now(),
        });
      }

      console.log(
        `[worker] ↻ ${request.id} retrying (${res.status}) — next attempt in ~${Math.round((postponeNextRetryAt - Date.now()) / 1000)}s`,
      );
      return updateRequest.run({
        id: request.id,
        status: RequestStatusEnum.RETRYING,
        attemptCount: newAttemptCount,
        nextRetryAt: postponeNextRetryAt,
        lastError: err,
        result: null,
        now: Date.now(),
      });
    }
  } catch (err) {
    const durationMs = Date.now() - start;
    const newAttemptCount = request.attempt_count + 1;
    const errorMessage = err instanceof Error ? err.message : String(err);

    const postponeNextRetryAt = calculateNextRetry(
      request.backoff_ms,
      newAttemptCount,
    );

    insertAttempt.run({
      requestId: request.id,
      attemptNumber: newAttemptCount,
      statusCode: null,
      error: errorMessage,
      durationMs,
      attemptedAt: start,
    });

    if (newAttemptCount >= request.max_retries) {
      console.log(
        `[worker] ✗ ${request.id} failed permanently (network error) — max retries reached`,
      );
      return updateRequest.run({
        id: request.id,
        status: RequestStatusEnum.FAILED,
        attemptCount: newAttemptCount,
        nextRetryAt: null,
        lastError: errorMessage,
        result: null,
        now: Date.now(),
      });
    } else {
      console.log(
        `[worker] ↻ ${request.id} retrying (network error) — next attempt in ~${Math.round((postponeNextRetryAt - Date.now()) / 1000)}s`,
      );
      updateRequest.run({
        id: request.id,
        status: RequestStatusEnum.RETRYING,
        attemptCount: newAttemptCount,
        nextRetryAt: postponeNextRetryAt,
        lastError: errorMessage,
        result: null,
        now: Date.now(),
      });
    }
  }
}

const calculateNextRetry = (
  backoffMs: number,
  attemptCount: number,
): number => {
  const jitter = 0.8 + Math.random() * 0.4;
  const wait = backoffMs * Math.pow(2, attemptCount) * jitter;
  return Date.now() + wait;
};

const shouldRetry = (status: number): boolean => {
  return status >= 500 || status === 429 || status === 408;
};

export function startWorker() {
  async function loop() {
    await runWorker();
    setTimeout(loop, 500);
  }
  loop();
}
