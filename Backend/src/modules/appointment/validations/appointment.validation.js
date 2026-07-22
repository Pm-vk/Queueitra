import { z } from "zod";
import ApiError from "../../../utils/ApiError.js";
import { APPOINTMENT_STATUS_VALUES } from "../constants/appointment.constants.js";

/**
 * Reusable Zod validation middleware.
 * Mirrors the pattern from auth.validation.js and donor.validation.js.
 * @param {z.ZodSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return next(new ApiError(400, errorMessage || "Validation failed"));
    }
    next(error);
  }
};

// ─── Shared Field Schemas ────────────────────────────────────────────────────

const mongoIdSchema = (fieldName) =>
  z
    .string({ required_error: `${fieldName} is required` })
    .min(1, `${fieldName} cannot be empty`);

const timeSlotSchema = z
  .string({ required_error: "Time slot is required" })
  .regex(
    /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    "Time slot must be in HH:MM 24-hour format (e.g. 09:30)"
  );

const futureDateSchema = z
  .string({ required_error: "Appointment date is required" })
  .refine((val) => !isNaN(Date.parse(val)), {
    message: "appointmentDate must be a valid date string (e.g. 2026-08-01)",
  });

// ─── Create Schema ───────────────────────────────────────────────────────────

/**
 * Schema for booking a new appointment.
 * Structural validation only — date-in-past, slot capacity, and
 * office hours checks are enforced by the service layer.
 */
const createAppointmentSchema = z.object({
  donorId: mongoIdSchema("Donor ID"),

  officeId: mongoIdSchema("Office ID"),

  staffId: z
    .string()
    .min(1, "Staff ID cannot be empty")
    .optional()
    .nullable(),

  appointmentDate: futureDateSchema,

  timeSlot: timeSlotSchema,

  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must not exceed 500 characters")
    .optional()
    .nullable(),
});

// ─── Update Schema ────────────────────────────────────────────────────────────

/**
 * General update — ADMIN/SUPER_ADMIN only.
 * Does NOT include status (use updateStatusSchema instead).
 * Does NOT include donorId (donor cannot change after booking).
 */
const updateAppointmentSchema = z
  .object({
    staffId: z.string().min(1).optional().nullable(),
    remarks: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

// ─── Status Update Schema ─────────────────────────────────────────────────────

/**
 * Dedicated schema for status transitions.
 * STAFF, ADMIN, and SUPER_ADMIN can advance status.
 * CUSTOMER can only set CANCELLED (enforced in service layer).
 */
const updateStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUS_VALUES, {
    errorMap: () => ({
      message: `Invalid status. Valid values: ${APPOINTMENT_STATUS_VALUES.join(", ")}`,
    }),
  }),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must not exceed 500 characters")
    .optional()
    .nullable(),
});

// ─── Reschedule Schema ────────────────────────────────────────────────────────

/**
 * Reschedule moves an appointment to a new date and/or time slot.
 * Both fields are optional individually — at least one must be present
 * (validated in service layer to avoid requiring both every time).
 */
const rescheduleAppointmentSchema = z
  .object({
    appointmentDate: futureDateSchema.optional(),
    timeSlot: timeSlotSchema.optional(),
    remarks: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (data) => data.appointmentDate !== undefined || data.timeSlot !== undefined,
    { message: "At least one of appointmentDate or timeSlot must be provided" }
  );

// ─── Assign Staff Schema ──────────────────────────────────────────────────────

const assignStaffSchema = z.object({
  staffId: mongoIdSchema("Staff User ID"),
});

export {
  validate,
  createAppointmentSchema,
  updateAppointmentSchema,
  updateStatusSchema,
  rescheduleAppointmentSchema,
  assignStaffSchema,
};
