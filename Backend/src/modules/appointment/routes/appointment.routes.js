import { Router } from "express";
import appointmentController from "../controllers/appointment.controller.js";
import { protect, authorize } from "../../../middlewares/auth.middleware.js";
import {
  validate,
  createAppointmentSchema,
  updateAppointmentSchema,
  updateStatusSchema,
  rescheduleAppointmentSchema,
  assignStaffSchema,
} from "../validations/appointment.validation.js";

const router = Router();

// ─── All appointment routes require authentication ────────────────────────
router.use(protect);

// ─── Named / Sub-Resource Routes (must be BEFORE /:id to avoid collision) ─

/**
 * GET /api/v1/appointments/upcoming
 * All authenticated users — service scopes CUSTOMER to own records.
 */
router.get("/upcoming", appointmentController.getUpcomingAppointments);

/**
 * GET /api/v1/appointments/today
 * All authenticated users — service scopes CUSTOMER to own records.
 */
router.get("/today", appointmentController.getTodaysAppointments);

/**
 * GET /api/v1/appointments/history
 * All authenticated users — service scopes CUSTOMER to own records.
 */
router.get("/history", appointmentController.getAppointmentHistory);

// ─── Collection Routes ────────────────────────────────────────────────────

/**
 * POST /api/v1/appointments
 * CUSTOMER (own donor profile), STAFF, ADMIN, SUPER_ADMIN.
 * Service enforces CUSTOMER self-booking restriction.
 */
router.post(
  "/",
  validate(createAppointmentSchema),
  appointmentController.createAppointment
);

/**
 * GET /api/v1/appointments
 * All authenticated — service scopes CUSTOMER to own.
 */
router.get("/", appointmentController.getAllAppointments);

// ─── Single Resource Routes ───────────────────────────────────────────────

/**
 * GET /api/v1/appointments/:id
 */
router.get("/:id", appointmentController.getAppointmentById);

/**
 * PATCH /api/v1/appointments/:id
 * General field update (remarks, staffId) — ADMIN and SUPER_ADMIN only.
 */
router.patch(
  "/:id",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(updateAppointmentSchema),
  appointmentController.updateAppointment
);

/**
 * PATCH /api/v1/appointments/:id/status
 * CUSTOMER (cancel only), STAFF, ADMIN, SUPER_ADMIN.
 * Service enforces per-role restrictions on which statuses are reachable.
 */
router.patch(
  "/:id/status",
  validate(updateStatusSchema),
  appointmentController.updateAppointmentStatus
);

/**
 * PATCH /api/v1/appointments/:id/cancel
 * CUSTOMER (own), STAFF, ADMIN, SUPER_ADMIN.
 * Convenience endpoint — wraps status update to CANCELLED.
 */
router.patch("/:id/cancel", appointmentController.cancelAppointment);

/**
 * PATCH /api/v1/appointments/:id/reschedule
 * ADMIN and SUPER_ADMIN only — re-runs full booking validation.
 */
router.patch(
  "/:id/reschedule",
  authorize("ADMIN", "SUPER_ADMIN"),
  validate(rescheduleAppointmentSchema),
  appointmentController.rescheduleAppointment
);

/**
 * PATCH /api/v1/appointments/:id/assign-staff
 * STAFF (self-assign only), ADMIN, SUPER_ADMIN.
 * Service enforces STAFF self-assignment restriction.
 */
router.patch(
  "/:id/assign-staff",
  authorize("STAFF", "ADMIN", "SUPER_ADMIN"),
  validate(assignStaffSchema),
  appointmentController.assignStaff
);

export default router;
