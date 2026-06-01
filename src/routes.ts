import { Request, Response, Router } from "express";
import { isValidHttpMethod, VALID_METHODS } from "./utils";
import db from "./db";
import { v7 } from 'uuid';

const router = Router();

const insertRequest = db.prepare(`
    INSERT INTO requests (id, url, method, body max_retries, backoff_ms)
    VALUES (@id, @url, @method @body, @maxRetries, @backoffMs)
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
    return res.json({
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
            message: "maxRetries must be a number if present"
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
    insertRequest.run({
        id,
        url,
        method,
        body: body ? JSON.stringify(body) : null,
        maxRetries,
        backoffMs
    })
    return res.status(201).json({
        id,
        status: "pending",
    })
  } catch (err) {
    return res.status(500).json({
        status: "error",
        message: "Failed to save request"
    })
  }
});

export default router;
