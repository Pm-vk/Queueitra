import { Router } from "express";
import staffController from "./staff.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import {
  validate,
  createStaffSchema,
  updateStaffSchema,
  assignOfficeSchema,
} from "./staff.validation.js";

const router = Router();

// All staff routes require authentication
router.use(protect);

// ─── Public Read Routes (any authenticated user) ──────────────────────────

router.get("/", staffController.getAllStaff);
router.get("/:id", staffController.getStaffById);

// ─── Admin-Only Write Routes ──────────────────────────────────────────────

router.post(
  "/",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(createStaffSchema),
  staffController.createStaff
);

router.patch(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(updateStaffSchema),
  staffController.updateStaff
);

router.delete(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  staffController.deleteStaff
);

router.patch(
  "/:id/activate",
  authorize("ADMIN", "SUPER_ADMIN"),
  staffController.activateStaff
);

router.patch(
  "/:id/deactivate",
  authorize("ADMIN", "SUPER_ADMIN"),
  staffController.deactivateStaff
);

router.patch(
  "/:id/assign-office",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(assignOfficeSchema),
  staffController.assignStaffToOffice
);

export default router;
