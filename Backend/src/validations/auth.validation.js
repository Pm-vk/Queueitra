import { z } from "zod";
import ApiError from "../utils/ApiError.js";

/**
 * Reusable validation middleware that checks the request body against a Zod schema
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

// Zod schemas for authentication requests
const registerSchema = z.object({
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
    .regex(/^\+?[0-9]{10,15}$/, "Phone number must be between 10 and 15 digits"),
  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters"),
  role: z
    .enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
    .default("CUSTOMER"),
  profileImage: z
    .string()
    .url("Invalid profile image URL")
    .optional(),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format"),
  password: z
    .string({ required_error: "Password is required" }),
});

export { validate, registerSchema, loginSchema };
