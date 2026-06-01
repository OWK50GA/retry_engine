import express from "express";
import httpRoutes from "./routes";
import { startWorker } from "./worker";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  return res.json({
    status: "healthy",
  });
});

app.use("/", httpRoutes);

app.listen(3001, () => {
  console.log("Server is running on port 3001");
  startWorker();
});
