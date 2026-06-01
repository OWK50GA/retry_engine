import { Request, Response, Router } from "express";
import {
  isValidHttpMethod,
  isValidRequestStatus,
  VALID_METHODS,
} from "./utils";
import db from "./db";
import { v7 } from "uuid";

const router = Router();

const insertRequest = db.prepare(`
    INSERT INTO requests (id, url, method, body, max_retries, backoff_ms)
    VALUES (@id, @url, @method, @body, @maxRetries, @backoffMs)
`);

const getRequestById = db.prepare(`
    SELECT * FROM requests WHERE id = ?
`);

const getAttemptsByRequestId = db.prepare(`
    SELECT * FROM attempts
    WHERE request_id = ?
    ORDER BY attempt_number ASC
`);

const getRequestsByStatus = db.prepare(`
    SELECT * FROM requests
    WHERE status = ?
    ORDER BY created_at DESC
`);

const getAllRequests = db.prepare(`
    SELECT * FROM requests
    ORDER BY status ASC
`);

router.post("/request", (req: Request, res: Response) => {
  const { url, method, body, maxRetries, backoffMs } = req.body;

  if (!url) {
    return res.status(400).json({
      status: "error",
      message: "Request URL is required",
    });
  }

  if (typeof url !== "string" || !url.startsWith("http")) {
    return res.status(400).json({
      status: "error",
      message: "Invalid request URL",
    });
  }

  if (!method) {
    return res.status(400).json({
      status: "error",
      message: "Request method is required",
    });
  }

  if (!isValidHttpMethod(method)) {
    return res.status(400).json({
      status: "error",
      message: `Invalid method. Must be one of: ${VALID_METHODS.join(", ")}`,
    });
  }

  if (maxRetries) {
    if (isNaN(parseInt(maxRetries))) {
      return res.status(400).json({
        status: "error",
        message: "maxRetries must be a number if present",
      });
    }
  }

  if (backoffMs) {
    if (isNaN(parseInt(backoffMs))) {
      return res.status(400).json({
        status: "error",
        message: "backoffMs must be a millisecond number if present",
      });
    }
  }

  const id = v7();

  try {
    const result = insertRequest.run({
      id,
      url,
      method,
      body: body ? JSON.stringify(body) : null,
      maxRetries,
      backoffMs,
    });

    return res.status(201).json({
      status: "success",
      data: {
        id,
        status: "pending",
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Failed to save request",
    });
  }
});

router.get("/requests/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      status: "error",
      message: "Invalid request id",
    });
  }

  try {
    const request = getRequestById.get(id);

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "Request not found",
      });
    }

    const attempts = getAttemptsByRequestId.all(id);

    return res.status(200).json({
      status: "success",
      data: {
        ...request,
        attempts,
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Failed to get request",
    });
  }
});

router.get("/requests", (req: Request, res: Response) => {
  const { status } = req.query;

  if (status) {
    // I think this check is redundant sha, but anyhow
    if (typeof status !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Invalid status provided",
      });
    }

    if (!isValidRequestStatus(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status provided",
      });
    }
  }

  let requests;

  try {
    if (status) {
      requests = getRequestsByStatus.all(status);
    } else {
      requests = getAllRequests.all();
    }

    return res.status(200).json({
      status: "success",
      data: requests,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to get requests",
    });
  }
});

export default router;
