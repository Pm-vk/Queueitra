import jwt from "jsonwebtoken";
import authRepository from "../repositories/auth.repository.js";
import ApiError from "../utils/ApiError.js";
import { env } from "../config/env.js";

class AuthService {
  /**
   * Generate a JWT Access Token
   * @param {string} userId 
   * @param {string} role 
   * @returns {string} Signed JWT access token
   */
  generateAccessToken(userId, role) {
    return jwt.sign(
      { id: userId, role },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );
  }

  /**
   * Generate a JWT Refresh Token
   * @param {string} userId 
   * @returns {string} Signed JWT refresh token
   */
  generateRefreshToken(userId) {
    return jwt.sign(
      { id: userId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
  }

  /**
   * Register a new user with validation and token creation
   * @param {Object} userData 
   * @returns {Promise<Object>} Output object containing user profile, access token, and refresh token
   */
  async registerUser(userData) {
    const { name, email, phone, password, role, profileImage } = userData;

    // Check if user email already exists
    const existingUser = await authRepository.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, "A user with this email already exists");
    }

    // Create user in DB
    const user = await authRepository.createUser({
      name,
      email,
      phone,
      password,
      role,
      profileImage,
    });

    // Generate credentials
    const accessToken = this.generateAccessToken(user._id, user.role);
    const refreshToken = this.generateRefreshToken(user._id);

    // Save refresh token to user
    await authRepository.updateRefreshToken(user._id, refreshToken);

    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshToken;

    return { user: userObject, accessToken, refreshToken };
  }

  /**
   * Authenticate user, compare passwords, and issue session tokens
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} Output containing user profile, access token, and refresh token
   */
  async loginUser(email, password) {
    // Explicitly include password for verification
    const user = await authRepository.findByEmail(email, true);
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Compare candidate password with hash
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Generate session credentials
    const accessToken = this.generateAccessToken(user._id, user.role);
    const refreshToken = this.generateRefreshToken(user._id);

    // Save refresh token in DB
    await authRepository.updateRefreshToken(user._id, refreshToken);

    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshToken;

    return { user: userObject, accessToken, refreshToken };
  }

  /**
   * Log out user by clearing the stored refresh token
   * @param {string} userId 
   * @returns {Promise<void>}
   */
  async logoutUser(userId) {
    await authRepository.clearRefreshToken(userId);
  }

  /**
   * Issue new access/refresh tokens in exchange for a valid refresh token (rotation)
   * @param {string} oldRefreshToken 
   * @returns {Promise<Object>} Rotated credentials and user profile
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

    // Locate the user by current active refresh token
    const user = await authRepository.findByRefreshToken(oldRefreshToken);
    if (!user) {
      throw new ApiError(401, "Refresh token is invalid or has been revoked");
    }

    // Generate new credentials
    const accessToken = this.generateAccessToken(user._id, user.role);
    const newRefreshToken = this.generateRefreshToken(user._id);

    // Rotate token in DB
    await authRepository.updateRefreshToken(user._id, newRefreshToken);

    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshToken;

    return { user: userObject, accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Retrieve user profile details by ID
   * @param {string} userId 
   * @returns {Promise<Object>} The User document
   */
  async getUserById(userId) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "User profile not found");
    }
    return user;
  }
}

export default new AuthService();
