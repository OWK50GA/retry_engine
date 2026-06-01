export enum RequestStatus {
  PENDING = "pending",
  RETRYING = "retrying",
  COMPLETED = "completed",
  FAILED = "failed",
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";
