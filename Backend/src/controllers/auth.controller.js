import authService from "../services/auth.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { env } from "../config/env.js";

// Secure cookie configuration for production environments
const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching token expiry
  path: "/",
};

class AuthController {
  /**
   * Handle user registration request
   */
  register = asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.registerUser(req.body);

    return res
      .status(201)
      .cookie("refreshToken", refreshToken, refreshTokenCookieOptions)
      .json(
        new ApiResponse(201, "User registered successfully", {
          user,
          accessToken,
        })
      );
  });

  /**
   * Handle user login request and issue tokens
   */
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginUser(email, password);

    return res
      .status(200)
      .cookie("refreshToken", refreshToken, refreshTokenCookieOptions)
      .json(
        new ApiResponse(200, "User logged in successfully", {
          user,
          accessToken,
        })
      );
  });

  /**
   * Handle user logout request and invalidate session
   */
  logout = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    await authService.logoutUser(userId);

    const clearCookieOptions = {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    };

    return res
      .status(200)
      .clearCookie("refreshToken", clearCookieOptions)
      .json(new ApiResponse(200, "User logged out successfully"));
  });

  /**
   * Refresh access token and rotate the refresh token
   */
  refreshToken = asyncHandler(async (req, res) => {
    const oldRefreshToken = req.cookies?.refreshToken;
    if (!oldRefreshToken) {
      throw new ApiError(401, "Refresh token is missing");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refreshAccessToken(oldRefreshToken);

    return res
      .status(200)
      .cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions)
      .json(
        new ApiResponse(200, "Token refreshed successfully", {
          accessToken,
        })
      );
  });

  /**
   * Get currently logged-in user profile
   */
  getCurrentUser = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const user = await authService.getCurrentUser(userId);

    return res
      .status(200)
      .json(
        new ApiResponse(200, "User profile retrieved successfully", {
          user,
        })
      );
  });
}

export default new AuthController();
