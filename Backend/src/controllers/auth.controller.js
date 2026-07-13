import authService from "../services/auth.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { env } from "../config/env.js";

// Global cookie configuration options
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

const accessTokenOptions = {
  ...cookieOptions,
  maxAge: 15 * 60 * 1000, // 15 minutes
};

const refreshTokenOptions = {
  ...cookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

class AuthController {
  /**
   * Register a new user and set session cookies
   */
  register = asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.registerUser(req.body);

    return res
      .status(201)
      .cookie("accessToken", accessToken, accessTokenOptions)
      .cookie("refreshToken", refreshToken, refreshTokenOptions)
      .json(
        new ApiResponse(201, "User registered successfully", {
          user,
          accessToken,
          refreshToken,
        })
      );
  });

  /**
   * Login user, compare credentials, and set session cookies
   */
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginUser(email, password);

    return res
      .status(200)
      .cookie("accessToken", accessToken, accessTokenOptions)
      .cookie("refreshToken", refreshToken, refreshTokenOptions)
      .json(
        new ApiResponse(200, "User logged in successfully", {
          user,
          accessToken,
          refreshToken,
        })
      );
  });

  /**
   * Logout user, clear DB session, and delete client cookies
   */
  logout = asyncHandler(async (req, res) => {
    await authService.logoutUser(req.user._id);

    const clearOptions = {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    };

    return res
      .status(200)
      .clearCookie("accessToken", clearOptions)
      .clearCookie("refreshToken", clearOptions)
      .json(new ApiResponse(200, "Logged out successfully"));
  });

  /**
   * Refresh and rotate active credentials
   */
  refresh = asyncHandler(async (req, res) => {
    const oldRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!oldRefreshToken) {
      throw new ApiError(401, "Refresh token is missing");
    }

    const { user, accessToken, refreshToken: newRefreshToken } =
      await authService.refreshAccessToken(oldRefreshToken);

    return res
      .status(200)
      .cookie("accessToken", accessToken, accessTokenOptions)
      .cookie("refreshToken", newRefreshToken, refreshTokenOptions)
      .json(
        new ApiResponse(200, "Tokens refreshed successfully", {
          user,
          accessToken,
          refreshToken: newRefreshToken,
        })
      );
  });

  /**
   * Fetch current user profile details
   */
  me = asyncHandler(async (req, res) => {
    return res
      .status(200)
      .json(
        new ApiResponse(200, "Current user retrieved successfully", {
          user: req.user,
        })
      );
  });
}

export default new AuthController();
