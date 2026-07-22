import { z } from "zod";
import ApiError from "../../../utils/ApiError.js";
import {
  COMPONENT_TYPE_VALUES,
  INVENTORY_STATUS_VALUES,
} from "../constants/inventory.constants.js";

/**
 * Reusable Zod validation middleware.
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

// ─── Shared Schemas ───────────────────────────────────────────────────────────

const mongoIdSchema = (fieldName) =>
  z
    .string({ required_error: `${fieldName} is required` })
    .min(1, `${fieldName} cannot be empty`);

const positiveNumberSchema = (fieldName) =>
  z
    .number({ invalid_type_error: `${fieldName} must be a number` })
    .positive(`${fieldName} must be positive`);

const dateStringSchema = (fieldName) =>
  z
    .string({ required_error: `${fieldName} is required` })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: `${fieldName} must be a valid ISO 8601 date string`,
    });

// ─── Manual Create Schema ─────────────────────────────────────────────────────

/**
 * Schema for ADMIN manually creating an inventory unit.
 * (Auto-created units bypass this — they come from the donation workflow.)
 * collectionDate is required; expiryDate is auto-calculated in service
 * but can be overridden if needed (e.g., externally donated/imported blood).
 */
const createInventorySchema = z.object({
  donorId: mongoIdSchema("Donor ID"),

  donationId: z
    .string()
    .min(1, "Donation ID cannot be empty")
    .optional()
    .nullable(),

  officeId: mongoIdSchema("Office ID"),

  bloodGroup: z
    .string({ required_error: "Blood group is required" })
    .min(1, "Blood group cannot be empty"),

  componentType: z.enum(COMPONENT_TYPE_VALUES, {
    errorMap: () => ({
      message: `Invalid component type. Valid: ${COMPONENT_TYPE_VALUES.join(", ")}`,
    }),
  }),

  collectionDate: dateStringSchema("Collection date"),

  /**
   * Optional override — service calculates expiryDate automatically
   * from componentType + collectionDate if not provided.
   */
  expiryDate: dateStringSchema("Expiry date").optional(),

  volume: positiveNumberSchema("Volume"),

  storageLocation: z.string().trim().max(200).optional().nullable(),

  temperature: z.number().optional().nullable(),

  remarks: z.string().trim().max(500).optional().nullable(),
});

// ─── Update Schema ────────────────────────────────────────────────────────────

/**
 * Update non-status fields: storage location, temperature, remarks.
 * Core identity fields (donorId, donationId, officeId, bloodGroup, componentType)
 * are immutable after creation.
 */
const updateInventorySchema = z
  .object({
    storageLocation: z.string().trim().max(200).optional().nullable(),
    temperature: z.number().optional().nullable(),
    remarks: z.string().trim().max(500).optional().nullable(),
    volume: positiveNumberSchema("Volume").optional(),
  })
  .strict();

// ─── Status Update Schema ─────────────────────────────────────────────────────

/**
 * Generic status transition — used by ADMIN for direct status changes.
 * Convenience endpoints (reserve, release, issue, expire, discard) provide
 * typed, role-aware alternatives.
 */
const updateStatusSchema = z.object({
  status: z.enum(INVENTORY_STATUS_VALUES, {
    errorMap: () => ({
      message: `Invalid status. Valid: ${INVENTORY_STATUS_VALUES.join(", ")}`,
    }),
  }),
  remarks: z.string().trim().max(500).optional().nullable(),
});

// ─── Reserve Schema ───────────────────────────────────────────────────────────

const reserveSchema = z.object({
  reservedFor: mongoIdSchema("Reserved For (User ID)"),
  remarks: z.string().trim().max(500).optional().nullable(),
});

// ─── Issue Schema ─────────────────────────────────────────────────────────────

const issueSchema = z.object({
  issuedTo: z
    .string({ required_error: "issuedTo is required" })
    .min(1, "issuedTo cannot be empty")
    .max(200, "issuedTo must not exceed 200 characters"),
  remarks: z.string().trim().max(500).optional().nullable(),
});

// ─── Transfer Schema ──────────────────────────────────────────────────────────

const transferSchema = z.object({
  toOfficeId: mongoIdSchema("Destination Office ID"),
  remarks: z.string().trim().max(500).optional().nullable(),
});

// ─── Discard Schema ───────────────────────────────────────────────────────────

const discardSchema = z.object({
  remarks: z
    .string({ required_error: "Reason for discarding is required" })
    .min(5, "Please provide a reason (at least 5 characters) for discarding this unit")
    .max(500),
});

export {
  validate,
  createInventorySchema,
  updateInventorySchema,
  updateStatusSchema,
  reserveSchema,
  issueSchema,
  transferSchema,
  discardSchema,
};
