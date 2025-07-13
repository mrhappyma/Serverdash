import express from "express";
import {
  handleIncomingApplication,
  submittedApplicationSchema,
} from "./applications";
import { register } from "prom-client";
import agenda from "./jobs";
import dailyStats from "./daily-stats";

const api = express();
api.use(express.json());

api.post("/api/applications/submit", (req, res) => {
  try {
    const data = submittedApplicationSchema.parse(req.body);
    handleIncomingApplication(data);
    return res.sendStatus(202);
  } catch {
    return res.sendStatus(400);
  }
});

api.get("/api/stats/yesterday", async (req, res) => {
  res.json(dailyStats);
});

api.get("/metrics", async (req, res) => {
  res
    .header("Content-Type", register.contentType)
    .send(await register.metrics());
});

const Agendash = require("agendash");
api.use("/admin/jobs", Agendash(agenda, {}));

api.get("/", (req, res) => {
  res.sendStatus(200);
});

api.listen(3000, () => {
  console.log("API is running on port 3000");
});
