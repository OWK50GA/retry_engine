import { HttpMethod, RequestStatus } from "./types";

export const VALID_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
] as const;

export const VALID_REQ_STATUSES = [
  "pending",
  "retrying",
  "completed",
  "failed",
];

export const isValidHttpMethod = (m: unknown): m is HttpMethod => {
  return (
    typeof m === "string" &&
    VALID_METHODS.includes(m.toUpperCase() as HttpMethod)
  );
};

export const isValidRequestStatus = (s: unknown): s is RequestStatus => {
  return (
    typeof s === "string" &&
    VALID_REQ_STATUSES.includes(s.toLowerCase() as RequestStatus)
  );
};
