import Staff from "./staff.model.js";

class StaffRepository {
  /**
   * Insert a new staff document into the database
   * @param {Object} staffData
   * @returns {Promise<Object>} The created Staff document
   */
  async createStaff(staffData) {
    try {
      return await Staff.create(staffData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a staff member by ID (returns a lean document for performance)
   * @param {string} id
   * @returns {Promise<Object|null>} The Staff document or null
   */
  async findById(id) {
    try {
      return await Staff.findById(id)
        .populate("officeId", "name city officeType")
        .populate("createdBy", "name email")
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a staff member by email
   * @param {string} email
   * @returns {Promise<Object|null>} The Staff document or null
   */
  async findByEmail(email) {
    try {
      return await Staff.findOne({ email }).lean().exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a staff member by phone number
   * @param {string} phone
   * @returns {Promise<Object|null>} The Staff document or null
   */
  async findByPhone(phone) {
    try {
      return await Staff.findOne({ phone }).lean().exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Query staff with pagination, filtering, text searching, and sorting
   * Supports filters: officeId, isActive, designation, search (text)
   * @param {Object} options Configuration parameters for query building
   * @returns {Promise<Object>} Paginated query metadata and staff collection
   */
  async findAllStaff(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        officeId,
        designation,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const filter = {};

      // Only apply isActive filter when explicitly passed
      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      if (officeId) {
        filter.officeId = officeId;
      }

      if (designation) {
        // Case-insensitive partial match on designation
        filter.designation = { $regex: designation, $options: "i" };
      }

      if (search) {
        filter.$text = { $search: search };
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

      // Boost text-match relevance when a search term is present
      if (search) {
        sort.score = { $meta: "textScore" };
      }

      const query = Staff.find(filter)
        .populate("officeId", "name city officeType")
        .populate("createdBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      if (search) {
        query.select({ score: { $meta: "textScore" } });
      }

      const [staff, total] = await Promise.all([
        query.exec(),
        Staff.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        staff,
        total,
        page: Number(page),
        totalPages,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing staff document by ID
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object|null>} The updated Staff document
   */
  async updateStaff(id, updateData) {
    try {
      return await Staff.findByIdAndUpdate(
        id,
        { $set: updateData },
        { returnDocument: "after", runValidators: true }
      )
        .populate("officeId", "name city officeType")
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Soft delete a staff member by setting isActive to false
   * @param {string} id
   * @returns {Promise<Object|null>} The updated Staff document
   */
  async softDeleteStaff(id) {
    try {
      return await Staff.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }
}

export default new StaffRepository();
