import { z } from "zod";
import ApiError from "../../../utils/ApiError.js";
import { VALID_BLOOD_GROUPS, VALID_GENDERS } from "../models/donor.model.js";

/**
 * Reusable Zod validation middleware.
 * Mirrors the pattern established in auth.validation.js and staff.validation.js.
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

// ─── Field-level Schemas (reusable) ─────────────────────────────────────────

const nameSchema = z
  .string({ required_error: "Name is required" })
  .trim()
  .min(1, "Name cannot be empty");

const emailSchema = z
  .string()
  .trim()
  .email("Invalid email format")
  .optional();

const phoneSchema = z
  .string({ required_error: "Phone number is required" })
  .trim()
  .regex(
    /^\+?[0-9]{10,15}$/,
    "Phone number must be 10–15 digits (optional leading +)"
  );

const dateOfBirthSchema = z
  .string({ required_error: "Date of birth is required" })
  .refine((val) => !isNaN(Date.parse(val)), {
    message: "dateOfBirth must be a valid date string (e.g. 1995-06-15)",
  });

const bloodGroupSchema = z
  .enum(VALID_BLOOD_GROUPS, {
    errorMap: () => ({
      message: `Invalid blood group. Valid values: ${VALID_BLOOD_GROUPS.join(", ")}`,
    }),
  })
  .optional();

const genderSchema = z
  .enum(VALID_GENDERS, {
    errorMap: () => ({
      message: `Invalid gender. Valid values: ${VALID_GENDERS.join(", ")}`,
    }),
  })
  .optional();

/**
 * Weight in kg — must be a positive number.
 * The >= 50 kg eligibility check is enforced in the service layer,
 * not here, so donors below 50 kg can be registered (just marked ineligible).
 */
const weightSchema = z
  .number({ invalid_type_error: "Weight must be a number" })
  .positive("Weight must be a positive number")
  .optional();

const heightSchema = z
  .number({ invalid_type_error: "Height must be a number" })
  .positive("Height must be a positive number")
  .optional();

const stringArraySchema = z
  .array(z.string().trim().min(1, "Array items cannot be empty strings"))
  .optional();

const officeIdSchema = z
  .string({ required_error: "Office ID is required" })
  .min(1, "Office ID cannot be empty");

// ─── Create Schema ───────────────────────────────────────────────────────────

/**
 * Full schema for registering a new donor.
 * Required fields: name, phone, dateOfBirth, officeId.
 * All medical / location fields are optional.
 */
const createDonorSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: dateOfBirthSchema,
  gender: genderSchema,
  bloodGroup: bloodGroupSchema,
  weight: weightSchema,
  height: heightSchema,
  lastDonationDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "lastDonationDate must be a valid date string",
    })
    .optional(),
  medicalConditions: stringArraySchema,
  currentMedications: stringArraySchema,
  allergies: stringArraySchema,
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  officeId: officeIdSchema,
});

// ─── Update Schema ───────────────────────────────────────────────────────────

/**
 * Partial update schema — every field is optional.
 * officeId is excluded; use the dedicated assign-office endpoint.
 */
const updateDonorSchema = createDonorSchema
  .omit({ officeId: true })
  .partial();

// ─── Assign Office Schema ────────────────────────────────────────────────────

const assignOfficeSchema = z.object({
  officeId: officeIdSchema,
});

export {
  validate,
  createDonorSchema,
  updateDonorSchema,
  assignOfficeSchema,
};
