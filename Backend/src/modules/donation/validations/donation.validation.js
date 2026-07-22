import { z } from "zod";
import ApiError from "../../../utils/ApiError.js";
import {
  DONATION_TYPE_VALUES,
  DONATION_STATUS_VALUES,
} from "../constants/donation.constants.js";

/**
 * Reusable Zod validation middleware. Mirrors all other module validation patterns.
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

const positiveNumberSchema = (fieldName) =>
  z
    .number({ invalid_type_error: `${fieldName} must be a number` })
    .positive(`${fieldName} must be a positive number`);

// ─── Blood Pressure Sub-Object ────────────────────────────────────────────────

const bloodPressureSchema = z
  .object({
    systolic: positiveNumberSchema("Systolic BP"),
    diastolic: positiveNumberSchema("Diastolic BP"),
  })
  .optional();

// ─── Create Schema ────────────────────────────────────────────────────────────

/**
 * Full schema for creating a donation record.
 * Structural and format validation only — physiological range checks
 * and cross-document business rules are enforced in the service.
 */
const createDonationSchema = z.object({
  donorId: mongoIdSchema("Donor ID"),

  appointmentId: mongoIdSchema("Appointment ID"),

  officeId: mongoIdSchema("Office ID"),

  staffId: mongoIdSchema("Staff ID"),

  bloodGroup: z
    .string({ required_error: "Blood group is required" })
    .min(1, "Blood group cannot be empty"),

  donationType: z.enum(DONATION_TYPE_VALUES, {
    errorMap: () => ({
      message: `Invalid donation type. Valid: ${DONATION_TYPE_VALUES.join(", ")}`,
    }),
  }),

  volume: positiveNumberSchema("Volume"),

  hemoglobinLevel: positiveNumberSchema("Hemoglobin level").optional(),

  bloodPressure: bloodPressureSchema,

  pulse: positiveNumberSchema("Pulse").optional(),

  temperature: positiveNumberSchema("Temperature").optional(),

  weight: positiveNumberSchema("Weight").optional(),

  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must not exceed 500 characters")
    .optional()
    .nullable(),

  collectionTime: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "collectionTime must be a valid ISO 8601 date string",
    })
    .optional(),
});

// ─── Update Schema ────────────────────────────────────────────────────────────

/**
 * ADMIN/SUPER_ADMIN: Update non-status fields (vitals, remarks, staffId).
 * Status transitions use the dedicated updateStatusSchema.
 * donorId, appointmentId, officeId are immutable after creation.
 */
const updateDonationSchema = z
  .object({
    staffId: z.string().min(1).optional(),
    bloodGroup: z.string().min(1).optional(),
    donationType: z
      .enum(DONATION_TYPE_VALUES, {
        errorMap: () => ({
          message: `Invalid donation type. Valid: ${DONATION_TYPE_VALUES.join(", ")}`,
        }),
      })
      .optional(),
    volume: positiveNumberSchema("Volume").optional(),
    hemoglobinLevel: positiveNumberSchema("Hemoglobin level").optional(),
    bloodPressure: bloodPressureSchema,
    pulse: positiveNumberSchema("Pulse").optional(),
    temperature: positiveNumberSchema("Temperature").optional(),
    weight: positiveNumberSchema("Weight").optional(),
    remarks: z.string().trim().max(500).optional().nullable(),
    collectionTime: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "collectionTime must be a valid date string",
      })
      .optional(),
  })
  .strict();

// ─── Status Update Schema ─────────────────────────────────────────────────────

/**
 * Dedicated schema for status transition requests.
 * The service enforces the state machine transitions.
 */
const updateDonationStatusSchema = z.object({
  status: z.enum(DONATION_STATUS_VALUES, {
    errorMap: () => ({
      message: `Invalid status. Valid: ${DONATION_STATUS_VALUES.join(", ")}`,
    }),
  }),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must not exceed 500 characters")
    .optional()
    .nullable(),
  completedAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "completedAt must be a valid date string",
    })
    .optional(),
});

export {
  validate,
  createDonationSchema,
  updateDonationSchema,
  updateDonationStatusSchema,
};
