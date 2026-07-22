import { Router } from "express";
import healthRouter from "./health.routes.js";
import authRouter from "./auth.routes.js";
import staffRouter from "../staff/staff.routes.js";
import donorRouter from "../modules/donor/routes/donor.routes.js";
import appointmentRouter from "../modules/appointment/routes/appointment.routes.js";
import donationRouter from "../modules/donation/routes/donation.routes.js";
import inventoryRouter from "../modules/inventory/routes/inventory.routes.js";
import bloodRequestRouter from "../modules/bloodRequest/routes/bloodRequest.routes.js";

const router = Router();

// Version 1 Router
const v1Router = Router();
v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/staff", staffRouter);
v1Router.use("/donors", donorRouter);
v1Router.use("/appointments", appointmentRouter);
v1Router.use("/donations", donationRouter);
v1Router.use("/inventory", inventoryRouter);
v1Router.use("/blood-requests", bloodRequestRouter);

// Mount version 1
router.use("/v1", v1Router);

export default router;

