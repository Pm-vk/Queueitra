import User from "../models/User.js";

class AuthRepository {
  /**
   * Create a new user in the database
   * @param {Object} userData 
   * @returns {Promise<Object>} The created User document
   */
  async createUser(userData) {
    return await User.create(userData);
  }

  /**
   * Find a user by email
   * @param {string} email 
   * @param {boolean} includePassword Whether to include the hashed password in the output
   * @returns {Promise<Object|null>} The User document or null
   */
  async findByEmail(email, includePassword = false) {
    const query = User.findOne({ email });
    if (includePassword) {
      query.select("+password");
    }
    return await query.exec();
  }

  /**
   * Find a user by ID
   * @param {string} id 
   * @returns {Promise<Object|null>} The User document or null
   */
  async findById(id) {
    return await User.findById(id).exec();
  }

  /**
   * Find a user by their refresh token
   * @param {string} refreshToken 
   * @returns {Promise<Object|null>} The User document or null
   */
  async findByRefreshToken(refreshToken) {
    return await User.findOne({ refreshToken }).select("+refreshToken").exec();
  }

  /**
   * Update the user's refresh token
   * @param {string} userId 
   * @param {string} refreshToken 
   * @returns {Promise<Object|null>} The updated User document
   */
  async updateRefreshToken(userId, refreshToken) {
    return await User.findByIdAndUpdate(
      userId,
      { refreshToken },
      { returnDocument: "after" }
    ).exec();
  }

  /**
   * Clear the user's refresh token (logout)
   * @param {string} userId 
   * @returns {Promise<Object|null>} The updated User document
   */
  async clearRefreshToken(userId) {
    return await User.findByIdAndUpdate(
      userId,
      { $unset: { refreshToken: 1 } },
      { returnDocument: "after" }
    ).exec();
  }
}

export default new AuthRepository();
