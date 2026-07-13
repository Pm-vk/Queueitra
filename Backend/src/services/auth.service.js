import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import authRepository from "../repositories/auth.repository.js";
import ApiError from "../utils/ApiError.js";
import { env } from "../config/env.js";

class AuthService {
  /**
   * Helper method to generate access tokens
   * @param {Object} user 
   * @returns {string} Signed JWT access token
   */
  generateAccessToken(user) {
    return jwt.sign(
      { id: user._id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );
  }

  /**
   * Helper method to generate refresh tokens
   * @param {Object} user 
   * @returns {string} Signed JWT refresh token
   */
  generateRefreshToken(user) {
    return jwt.sign(
      { id: user._id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
  }

  /**
   * Register a new user in the system
   * @param {Object} userData 
   * @returns {Promise<Object>} Output user details and tokens
   */
  async registerUser(userData) {
    const { name, email, phone, password, role, profileImage } = userData;

    // Check if email already registered
    const existingUser = await authRepository.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, "A user with this email already exists");
    }

    // Hash the password in the Service layer
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Persist user using Repository
    const user = await authRepository.createUser({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      profileImage,
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Save refresh token using Repository
    await authRepository.updateRefreshToken(user._id, refreshToken);

    // Sanitize response
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshToken;

    return { user: userObject, accessToken, refreshToken };
  }

  /**
   * Login user by validating email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} Sanitized user details and signed tokens
   */
  async loginUser(email, password) {
    // Retrieve user and select password hash explicitly
    const user = await authRepository.findByEmail(email, true);
    if (!user) {
      // Do not leak details about email existence
      throw new ApiError(401, "Invalid email or password");
    }

    // Verify password using bcrypt.compare
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store Refresh Token in DB via Repository
    await authRepository.updateRefreshToken(user._id, refreshToken);

    // Sanitize response
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshToken;

    return { user: userObject, accessToken, refreshToken };
  }

  /**
   * Verify and rotate tokens
   * @param {string} oldRefreshToken 
   * @returns {Promise<Object>} Rotated tokens and sanitized user
   */
  async refreshAccessToken(oldRefreshToken) {
    if (!oldRefreshToken) {
      throw new ApiError(401, "Refresh token is required");
    }

    let decoded;
    try {
      decoded = jwt.verify(oldRefreshToken, env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    // Locate user by the current stored refresh token via Repository
    const user = await authRepository.findByRefreshToken(oldRefreshToken);
    if (!user) {
      throw new ApiError(401, "Refresh token is invalid or has been revoked");
    }

    // Generate rotated tokens
    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    // Update database using Repository
    await authRepository.updateRefreshToken(user._id, newRefreshToken);

    // Sanitize user details
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshToken;

    return { user: userObject, accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Log user out and remove refresh token
   * @param {string} userId 
   * @returns {Promise<void>}
   */
  async logoutUser(userId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required for logout");
    }
    await authRepository.removeRefreshToken(userId);
  }

  /**
   * Get authenticated user profile
   * @param {string} userId 
   * @returns {Promise<Object>} Sanitized user document
   */
  async getCurrentUser(userId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const user = await authRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Standard output does not select password/refreshToken by default, but let's sanitize explicitly
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshToken;

    return userObject;
  }
}

export default new AuthService();
