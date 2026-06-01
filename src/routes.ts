import { Request, Response, Router } from "express";
import { isValidHttpMethod, VALID_METHODS } from "./utils";

const router = Router();

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
});

export default router;
