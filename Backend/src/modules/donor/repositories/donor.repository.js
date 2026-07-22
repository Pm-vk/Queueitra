import Donor from "../models/donor.model.js";

class DonorRepository {
  /**
   * Insert a new donor document into the database
   * @param {Object} donorData
   * @returns {Promise<Object>} The created Donor document
   */
  async createDonor(donorData) {
    try {
      return await Donor.create(donorData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a donor by ID with populated references
   * @param {string} id
   * @returns {Promise<Object|null>} The Donor document or null
   */
  async findById(id) {
    try {
      return await Donor.findById(id)
        .populate("officeId", "name city officeType")
        .populate("createdBy", "name email")
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a donor by email address
   * @param {string} email
   * @returns {Promise<Object|null>} The Donor document or null
   */
  async findByEmail(email) {
    try {
      return await Donor.findOne({ email }).lean().exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a donor by phone number
   * @param {string} phone
   * @returns {Promise<Object|null>} The Donor document or null
   */
  async findByPhone(phone) {
    try {
      return await Donor.findOne({ phone }).lean().exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a donor by the createdBy user reference
   * Used for CUSTOMER self-lookup
   * @param {string} userId
   * @returns {Promise<Object|null>} The Donor document or null
   */
  async findByCreatedBy(userId) {
    try {
      return await Donor.findOne({ createdBy: userId })
        .populate("officeId", "name city officeType")
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Paginated donor query supporting:
   *   - Text search on name (MongoDB text index)
   *   - Regex search on email and phone
   *   - Filters: bloodGroup, city, officeId, isEligible, isActive
   *   - Sorting: name, createdAt, lastDonationDate
   *   - Pagination: page, limit
   *
   * @param {Object} options
   * @returns {Promise<Object>} { donors, total, page, totalPages }
   */
  async findAllDonors(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        bloodGroup,
        city,
        officeId,
        isEligible,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
        // Restrict to a specific user's created donors (CUSTOMER role)
        createdBy,
      } = options;

      const filter = {};

      // ── Filters ──────────────────────────────────────────────────────────

      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      if (isEligible !== undefined) {
        filter.isEligible = isEligible;
      }

      if (bloodGroup) {
        filter.bloodGroup = bloodGroup;
      }

      if (city) {
        // Case-insensitive city match
        filter.city = { $regex: city, $options: "i" };
      }

      if (officeId) {
        filter.officeId = officeId;
      }

      if (createdBy) {
        filter.createdBy = createdBy;
      }

      // ── Search ────────────────────────────────────────────────────────────
      // Support searching by name (text index), email, or phone via $or + regex.
      // This allows partial matches unlike pure $text which requires full words.
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        filter.$or = [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ];
      }

      // ── Sort ──────────────────────────────────────────────────────────────
      const allowedSortFields = ["name", "createdAt", "lastDonationDate"];
      const resolvedSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";
      const sort = { [resolvedSortBy]: sortOrder === "asc" ? 1 : -1 };

      const skip = (Number(page) - 1) * Number(limit);

      const [donors, total] = await Promise.all([
        Donor.find(filter)
          .populate("officeId", "name city officeType")
          .populate("createdBy", "name email")
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean()
          .exec(),
        Donor.countDocuments(filter).exec(),
      ]);

      return {
        donors,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing donor document by ID
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object|null>} The updated Donor document (populated)
   */
  async updateDonor(id, updateData) {
    try {
      return await Donor.findByIdAndUpdate(
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
   * Soft delete a donor by setting isActive to false
   * Records are never permanently deleted.
   * @param {string} id
   * @returns {Promise<Object|null>} The updated Donor document
   */
  async softDeleteDonor(id) {
    try {
      return await Donor.findByIdAndUpdate(
        id,
        { $set: { isActive: false, isEligible: false } },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }
}

export default new DonorRepository();
