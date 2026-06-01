export type RequestStatus = "pending" | "retrying" | "completed" | "failed";

export enum RequestStatusEnum {
    PENDING = 'pending',
    RETRYING = 'retrying',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export type JobRequest = {
    id: string;
    url: string;
    method: string;
    // Body already stored as JSON.stringified, no need to parse when making call
    body?: string;
    status: RequestStatus;
    attempt_count: number;
    max_retries: number;
    backoff_ms: number;
    next_retry_at?: number;
    last_error: string | null;
    result: string | null;
    // Document why its number, not date
    created_at: number;
    updated_at: number;
}

export type Attempt = {
    id: number;
    request_id: string;
    attempt_number: number;
    status_code: number | null;
    error: string | null;
    duration_ms: number;
    attempted_at: number;
}
