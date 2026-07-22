import { z } from "zod";
import ApiError from "../utils/ApiError.js";

/**
 * Reusable Zod validation middleware
 * Mirrors the pattern established in auth.validation.js
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

/**
 * Schema for creating a new staff member
 */
const createStaffSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name cannot be empty"),

  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format"),

  phone: z
    .string({ required_error: "Phone number is required" })
    .trim()
    .regex(
      /^\+?[0-9]{10,15}$/,
      "Phone number must be between 10 and 15 digits"
    ),

  designation: z
    .string({ required_error: "Designation is required" })
    .trim()
    .min(1, "Designation cannot be empty"),

  officeId: z
    .string({ required_error: "Office ID is required" })
    .min(1, "Office ID cannot be empty"),

  joiningDate: z
    .string()
    .datetime({ message: "joiningDate must be a valid ISO 8601 date string" })
    .optional(),
});

/**
 * Schema for partial staff updates — all fields are optional
 * but at least one must be present (enforced in service layer)
 */
const updateStaffSchema = createStaffSchema
  .omit({ officeId: true }) // office reassignment uses its own dedicated endpoint
  .partial();

/**
 * Schema for reassigning a staff member to a different office
 */
const assignOfficeSchema = z.object({
  officeId: z
    .string({ required_error: "Office ID is required" })
    .min(1, "Office ID cannot be empty"),
});

export { validate, createStaffSchema, updateStaffSchema, assignOfficeSchema };
