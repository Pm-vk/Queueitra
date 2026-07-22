import { Router } from "express";
import donorController from "../controllers/donor.controller.js";
import { protect, authorize } from "../../../middlewares/auth.middleware.js";
import {
  validate,
  createDonorSchema,
  updateDonorSchema,
  assignOfficeSchema,
} from "../validations/donor.validation.js";

const router = Router();

// ─── All donor routes require authentication ──────────────────────────────
router.use(protect);

// ─── Read Routes ──────────────────────────────────────────────────────────
// All authenticated users can read; service layer scopes CUSTOMER to own record.

router.get("/", donorController.getAllDonors);
router.get("/:id", donorController.getDonorById);

// ─── Create Route ─────────────────────────────────────────────────────────
// CUSTOMER may self-register; STAFF and above can register any donor.
// The service layer enforces role-specific logic.

router.post(
  "/",
  validate(createDonorSchema),
  donorController.createDonor
);

// ─── Update Route ─────────────────────────────────────────────────────────
// CUSTOMER can update their own; STAFF+ can update any. Enforced in service.

router.patch(
  "/:id",
  validate(updateDonorSchema),
  donorController.updateDonor
);

// ─── Admin-Only Lifecycle Routes ──────────────────────────────────────────

router.delete(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  donorController.deleteDonor
);

router.patch(
  "/:id/activate",
  authorize("ADMIN", "SUPER_ADMIN"),
  donorController.activateDonor
);

router.patch(
  "/:id/deactivate",
  authorize("ADMIN", "SUPER_ADMIN"),
  donorController.deactivateDonor
);

router.patch(
  "/:id/assign-office",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(assignOfficeSchema),
  donorController.assignDonorToOffice
);

export default router;
