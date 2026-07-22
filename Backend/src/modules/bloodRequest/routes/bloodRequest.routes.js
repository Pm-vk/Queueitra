import { Router } from "express";
import bloodRequestController from "../controllers/bloodRequest.controller.js";
import { protect, authorize } from "../../../middlewares/auth.middleware.js";
import {
  validate,
  createBloodRequestSchema,
  updateBloodRequestSchema,
  approveRequestSchema,
  rejectRequestSchema,
  cancelRequestSchema,
} from "../validations/bloodRequest.validation.js";

const router = Router();

// ─── All routes require authentication ───────────────────────────────────
router.use(protect);

// ─── Named Sub-Routes (BEFORE /:id to avoid collision) ───────────────────

/**
 * GET /api/v1/blood-requests/dashboard
 * ADMIN, SUPER_ADMIN only — full statistics overview.
 */
router.get(
  "/dashboard",
  authorize("ADMIN", "SUPER_ADMIN"),
  bloodRequestController.getDashboard
);

// ─── Collection Routes ────────────────────────────────────────────────────

/**
 * POST /api/v1/blood-requests
 * STAFF, ADMIN, SUPER_ADMIN — CUSTOMER has no access.
 */
router.post(
  "/",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  validate(createBloodRequestSchema),
  bloodRequestController.createRequest
);

/**
 * GET /api/v1/blood-requests
 * STAFF (own only), ADMIN, SUPER_ADMIN.
 * Service scopes STAFF to their own records.
 */
router.get(
  "/",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  bloodRequestController.getAllRequests
);

// ─── Single Resource Routes ───────────────────────────────────────────────

/**
 * GET /api/v1/blood-requests/:id
 */
router.get(
  "/:id",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  bloodRequestController.getRequestById
);

/**
 * PATCH /api/v1/blood-requests/:id
 * STAFF (own PENDING), ADMIN, SUPER_ADMIN.
 * Service enforces STAFF restrictions.
 */
router.patch(
  "/:id",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  validate(updateBloodRequestSchema),
  bloodRequestController.updateRequest
);

/**
 * PATCH /api/v1/blood-requests/:id/approve
 * ADMIN, SUPER_ADMIN only.
 */
router.patch(
  "/:id/approve",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(approveRequestSchema),
  bloodRequestController.approveRequest
);

/**
 * PATCH /api/v1/blood-requests/:id/reject
 * ADMIN, SUPER_ADMIN only. Remarks required (enforced by Zod schema).
 */
router.patch(
  "/:id/reject",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(rejectRequestSchema),
  bloodRequestController.rejectRequest
);

/**
 * PATCH /api/v1/blood-requests/:id/cancel
 * STAFF (own, PENDING/UNDER_REVIEW), ADMIN, SUPER_ADMIN.
 * Service enforces STAFF restrictions.
 */
router.patch(
  "/:id/cancel",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  validate(cancelRequestSchema),
  bloodRequestController.cancelRequest
);

/**
 * PATCH /api/v1/blood-requests/:id/allocate
 * Triggers the allocation engine + inventory transaction.
 * ADMIN, SUPER_ADMIN only.
 */
router.patch(
  "/:id/allocate",
  authorize("ADMIN", "SUPER_ADMIN"),
  bloodRequestController.allocateBlood
);

/**
 * DELETE /api/v1/blood-requests/:id
 * Soft delete — ADMIN, SUPER_ADMIN only.
 * Service prevents deletion of FULFILLED records.
 */
router.delete(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  bloodRequestController.deleteRequest
);

export default router;
