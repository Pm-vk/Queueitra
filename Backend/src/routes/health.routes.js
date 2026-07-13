import { Router } from "express";
import { getHealthStatus } from "../controllers/health.controller.js";

const router = Router();

router.route("/").get(getHealthStatus);

export default router;
