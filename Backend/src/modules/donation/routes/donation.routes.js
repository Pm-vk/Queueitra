import { Router } from "express";
import donationController from "../controllers/donation.controller.js";
import { protect, authorize } from "../../../middlewares/auth.middleware.js";
import {
  validate,
  createDonationSchema,
  updateDonationSchema,
  updateDonationStatusSchema,
} from "../validations/donation.validation.js";

const router = Router();

// ─── All donation routes require authentication ───────────────────────────
router.use(protect);

// ─── Named Sub-Routes (must be BEFORE /:id to avoid route collision) ─────

/**
 * GET /api/v1/donations/history
 * All authenticated — CUSTOMER scoped to own records by service.
 */
router.get("/history", donationController.getDonationHistory);

// ─── Collection Routes ────────────────────────────────────────────────────

/**
 * POST /api/v1/donations
 * STAFF, ADMIN, SUPER_ADMIN only — service enforces this.
 */
router.post(
  "/",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  validate(createDonationSchema),
  donationController.createDonation
);

/**
 * GET /api/v1/donations
 * All authenticated — CUSTOMER scoped to own records by service.
 */
router.get("/", donationController.getAllDonations);

// ─── Single Resource Routes ───────────────────────────────────────────────

/**
 * GET /api/v1/donations/:id
 * All authenticated — CUSTOMER scoped to own records by service.
 */
router.get("/:id", donationController.getDonationById);

/**
 * PATCH /api/v1/donations/:id
 * General field update (vitals, remarks, staffId).
 * ADMIN and SUPER_ADMIN only.
 */
router.patch(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(updateDonationSchema),
  donationController.updateDonation
);

/**
 * PATCH /api/v1/donations/:id/status
 * Status transition endpoint — triggers full transactional workflow on COMPLETED.
 * STAFF, ADMIN, SUPER_ADMIN.
 */
router.patch(
  "/:id/status",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  validate(updateDonationStatusSchema),
  donationController.updateDonationStatus
);

/**
 * DELETE /api/v1/donations/:id
 * Soft delete — ADMIN and SUPER_ADMIN only.
 * Service prevents deletion of COMPLETED records.
 */
router.delete(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  donationController.deleteDonation
);

export default router;
