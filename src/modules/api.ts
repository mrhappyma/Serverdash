import express from "express";
import {
  handleIncomingApplication,
  submittedApplicationSchema,
} from "./applications";
import { register } from "prom-client";

const api = express();
api.use(express.json());

api.post("/api/applications/submit", (req, res) => {
  try {
    const data = submittedApplicationSchema.parse(req.body);
    handleIncomingApplication(data);
    return res.send(202);
  } catch {
    return res.send(400);
  }
});

api.get("/metrics", async (req, res) => {
  res
    .header("Content-Type", register.contentType)
    .send(await register.metrics());
});

api.get("/", (req, res) => {
  res.send(200);
});

api.listen(3000, () => {
  console.log("API is running on port 3000");
});
