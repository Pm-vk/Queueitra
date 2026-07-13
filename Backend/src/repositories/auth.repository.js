import User from "../models/User.js";

class AuthRepository {
  /**
   * Create a new user in the database
   * @param {Object} userData 
   * @returns {Promise<Object>} The created User document
   */
  async createUser(userData) {
    try {
      return await User.create(userData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a user by email
   * @param {string} email 
   * @param {boolean} includePassword Whether to select the password field
   * @returns {Promise<Object|null>} The User document or null
   */
  async findByEmail(email, includePassword = false) {
    try {
      const query = User.findOne({ email });
      if (includePassword) {
        query.select("+password");
      }
      return await query.exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a user by ID
   * @param {string} id 
   * @returns {Promise<Object|null>} The User document or null
   */
  async findById(id) {
    try {
      return await User.findById(id).exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update the user's refresh token
   * @param {string} userId 
   * @param {string} refreshToken 
   * @returns {Promise<Object|null>} The updated User document
   */
  async updateRefreshToken(userId, refreshToken) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { refreshToken },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove the user's refresh token (logout)
   * @param {string} userId 
   * @returns {Promise<Object|null>} The updated User document
   */
  async removeRefreshToken(userId) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { $unset: { refreshToken: 1 } },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set user's email/phone verification status to true
   * @param {string} userId 
   * @returns {Promise<Object|null>} The updated User document
   */
  async updateVerificationStatus(userId) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { isVerified: true },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update generic user profile data
   * @param {string} userId 
   * @param {Object} updateData 
   * @returns {Promise<Object|null>} The updated User document
   */
  async updateProfile(userId, updateData) {
    try {
      // Exclude sensitive fields from generic updates to prevent parameter injection
      const { password, role, refreshToken, isVerified, ...safeUpdateData } = updateData;

      return await User.findByIdAndUpdate(
        userId,
        { $set: safeUpdateData },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a user by their active refresh token
   * @param {string} refreshToken 
   * @returns {Promise<Object|null>} The User document or null
   */
  async findByRefreshToken(refreshToken) {
    try {
      return await User.findOne({ refreshToken }).select("+refreshToken").exec();
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthRepository();
