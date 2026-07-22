import { z } from "zod";
import ApiError from "../../../utils/ApiError.js";
import {
  REQUEST_PRIORITY_VALUES,
  REQUEST_STATUS_VALUES,
  VALID_BLOOD_GROUPS,
  PATIENT_GENDER_VALUES,
} from "../constants/bloodRequest.constants.js";
import { COMPONENT_TYPE_VALUES } from "../../inventory/constants/inventory.constants.js";

/**
 * Reusable Zod validation middleware — consistent with all other modules.
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

const dateStringSchema = (fieldName) =>
  z
    .string({ required_error: `${fieldName} is required` })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: `${fieldName} must be a valid ISO 8601 date string`,
    });

// ─── Create Schema ────────────────────────────────────────────────────────────

/**
 * Full schema for creating a blood request.
 * Date-in-past validation and cross-document rules enforced in service.
 */
const createBloodRequestSchema = z.object({
  hospitalName: z
    .string({ required_error: "Hospital name is required" })
    .trim()
    .min(2, "Hospital name must be at least 2 characters")
    .max(200, "Hospital name must not exceed 200 characters"),

  hospitalContact: z
    .string({ required_error: "Hospital contact is required" })
    .trim()
    .min(5, "Hospital contact must be at least 5 characters")
    .max(100),

  patientName: z
    .string({ required_error: "Patient name is required" })
    .trim()
    .min(2, "Patient name must be at least 2 characters")
    .max(150),

  patientAge: z
    .number({ required_error: "Patient age is required", invalid_type_error: "Patient age must be a number" })
    .int("Patient age must be a whole number")
    .min(0, "Patient age must be non-negative")
    .max(150, "Patient age must be realistic"),

  patientGender: z.enum(PATIENT_GENDER_VALUES, {
    errorMap: () => ({
      message: `Invalid gender. Valid: ${PATIENT_GENDER_VALUES.join(", ")}`,
    }),
  }),

  doctorName: z
    .string({ required_error: "Doctor name is required" })
    .trim()
    .min(2, "Doctor name must be at least 2 characters")
    .max(150),

  bloodGroup: z.enum(VALID_BLOOD_GROUPS, {
    errorMap: () => ({
      message: `Invalid blood group. Valid: ${VALID_BLOOD_GROUPS.join(", ")}`,
    }),
  }),

  componentType: z.enum(COMPONENT_TYPE_VALUES, {
    errorMap: () => ({
      message: `Invalid component type. Valid: ${COMPONENT_TYPE_VALUES.join(", ")}`,
    }),
  }),

  unitsRequested: z
    .number({ required_error: "Units requested is required", invalid_type_error: "Units must be a number" })
    .int("Units must be a whole number")
    .min(1, "At least 1 unit must be requested"),

  priority: z
    .enum(REQUEST_PRIORITY_VALUES, {
      errorMap: () => ({
        message: `Invalid priority. Valid: ${REQUEST_PRIORITY_VALUES.join(", ")}`,
      }),
    })
    .optional()
    .default("NORMAL"),

  reason: z
    .string({ required_error: "Medical reason is required" })
    .trim()
    .min(10, "Please provide a meaningful reason (at least 10 characters)")
    .max(1000),

  requiredBefore: dateStringSchema("Required before date"),

  officeId: mongoIdSchema("Office ID"),

  remarks: z.string().trim().max(500).optional().nullable(),
});

// ─── Update Schema ─────────────────────────────────────────────────────────────

/**
 * STAFF can update their own PENDING requests.
 * ADMIN can update any non-terminal request.
 * Core identity fields are immutable: bloodGroup, componentType, officeId.
 */
const updateBloodRequestSchema = z
  .object({
    hospitalName: z.string().trim().min(2).max(200).optional(),
    hospitalContact: z.string().trim().min(5).max(100).optional(),
    patientName: z.string().trim().min(2).max(150).optional(),
    patientAge: z.number().int().min(0).max(150).optional(),
    patientGender: z.enum(PATIENT_GENDER_VALUES).optional(),
    doctorName: z.string().trim().min(2).max(150).optional(),
    unitsRequested: z.number().int().min(1).optional(),
    priority: z.enum(REQUEST_PRIORITY_VALUES).optional(),
    reason: z.string().trim().min(10).max(1000).optional(),
    requiredBefore: dateStringSchema("Required before date").optional(),
    remarks: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

// ─── Approve Schema ────────────────────────────────────────────────────────────

const approveRequestSchema = z.object({
  remarks: z.string().trim().max(500).optional().nullable(),
});

// ─── Reject Schema ─────────────────────────────────────────────────────────────

const rejectRequestSchema = z.object({
  remarks: z
    .string({ required_error: "Rejection reason is required" })
    .trim()
    .min(5, "Please provide a rejection reason (at least 5 characters)")
    .max(500),
});

// ─── Cancel Schema ─────────────────────────────────────────────────────────────

const cancelRequestSchema = z.object({
  remarks: z.string().trim().max(500).optional().nullable(),
});

// ─── Status Update Schema ──────────────────────────────────────────────────────

const updateRequestStatusSchema = z.object({
  status: z.enum(REQUEST_STATUS_VALUES, {
    errorMap: () => ({
      message: `Invalid status. Valid: ${REQUEST_STATUS_VALUES.join(", ")}`,
    }),
  }),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export {
  validate,
  createBloodRequestSchema,
  updateBloodRequestSchema,
  approveRequestSchema,
  rejectRequestSchema,
  cancelRequestSchema,
  updateRequestStatusSchema,
};
