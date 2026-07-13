import jwt from "jsonwebtoken";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import authRepository from "../repositories/auth.repository.js";
import { env } from "../config/env.js";

/**
 * Protect routes by verifying JWT Access Token
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check header or cookies
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw new ApiError(401, "Not authorized, access token missing");
  }

  try {
    // Verify token validity
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Fetch user and attach to request context
    const user = await authRepository.findById(decoded.id);
    if (!user) {
      throw new ApiError(401, "Not authorized, user not found");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, "Not authorized, invalid access token");
  }
});

/**
 * Restrict access based on user role enums
 * @param {...string} roles 
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          "Forbidden, you do not have permission to access this resource"
        )
      );
    }
    next();
  };
};

export { protect, authorize };
