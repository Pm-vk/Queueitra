import { Router } from "express";
import healthRouter from "./health.routes.js";

const router = Router();

// Version 1 Router
const v1Router = Router();
v1Router.use("/health", healthRouter);

// Mount version 1
router.use("/v1", v1Router);

export default router;
