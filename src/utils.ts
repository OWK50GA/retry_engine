import { HttpMethod } from "./types";

export const VALID_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
] as const;

export const isValidHttpMethod = (m: unknown): m is HttpMethod => {
  return (
    typeof m === "string" &&
    VALID_METHODS.includes(m.toUpperCase() as HttpMethod)
  );
};
