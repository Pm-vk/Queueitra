import officeRepository from "../repositories/office.repository.js";
import ApiError from "../utils/ApiError.js";

class OfficeService {
  /**
   * Helper: Ensure the requesting user holds Admin or Super Admin privileges
   */
  _verifyAdminPrivileges(user) {
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      throw new ApiError(403, "Forbidden: Only Admin or Super Admin can perform this action");
    }
  }

  /**
   * Helper: Strip padding and normalize basic text fields
   */
  _normalizeOfficeData(data) {
    return {
      ...data,
      name: data.name ? data.name.trim() : undefined,
      description: data.description ? data.description.trim() : undefined,
      address: data.address ? data.address.trim() : undefined,
      city: data.city ? data.city.trim() : undefined,
      state: data.state ? data.state.trim() : undefined,
      country: data.country ? data.country.trim() : undefined,
      pincode: data.pincode ? data.pincode.trim() : undefined,
    };
  }

  /**
   * Helper: Assert that no other office with the same name exists in the same city
   */
  async _assertNoDuplicateNameInCity(name, city, excludeOfficeId = null) {
    if (!name || !city) return;
    const existingOffice = await officeRepository.findOfficeByName(name);
    if (existingOffice && existingOffice.city.toLowerCase() === city.toLowerCase()) {
      if (excludeOfficeId && existingOffice._id.toString() === excludeOfficeId.toString()) {
        return;
      }
      throw new ApiError(400, `An office named "${name}" already exists in the city "${city}"`);
    }
  }

  /**
   * Helper: Verify openingTime is strictly earlier than closingTime (HH:MM format)
   */
  _validateOperatingHours(openingTime, closingTime) {
    if (!openingTime || !closingTime) return;

    const toMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + minutes;
    };

    if (toMinutes(openingTime) >= toMinutes(closingTime)) {
      throw new ApiError(400, "Opening time must be earlier than closing time");
    }
  }

  /**
   * Register a new office location (Admin/Super Admin only)
   * @param {Object} officeData 
   * @param {Object} user Requesting user context
   * @returns {Promise<Object>} The created Office document
   */
  async createOffice(officeData, user) {
    this._verifyAdminPrivileges(user);

    const normalizedData = this._normalizeOfficeData(officeData);

    // Business checks
    this._validateOperatingHours(normalizedData.openingTime, normalizedData.closingTime);
    await this._assertNoDuplicateNameInCity(normalizedData.name, normalizedData.city);

    // Assign creator reference
    normalizedData.createdBy = user._id;

    return await officeRepository.createOffice(normalizedData);
  }

  /**
   * Retrieve a single office by ID
   * @param {string} id 
   * @returns {Promise<Object>} The Office document
   */
  async getOfficeById(id) {
    const office = await officeRepository.findOfficeById(id);
    if (!office) {
      throw new ApiError(404, "Office not found");
    }
    return office;
  }

  /**
   * Fetch all offices using query parameters
   * @param {Object} options Query parameters (filters, pagination)
   * @returns {Promise<Object>} Paginated office results
   */
  async getAllOffices(options = {}) {
    // Defaults to active-only for standard listings
    const queryOptions = { isActive: true, ...options };
    return await officeRepository.findAllOffices(queryOptions);
  }

  /**
   * Update office parameters (Admin/Super Admin only)
   * @param {string} id 
   * @param {Object} updateData 
   * @param {Object} user Requesting user context
   * @returns {Promise<Object>} The updated Office document
   */
  async updateOffice(id, updateData, user) {
    this._verifyAdminPrivileges(user);

    const existingOffice = await officeRepository.findOfficeById(id);
    if (!existingOffice) {
      throw new ApiError(404, "Office not found");
    }

    const normalizedUpdates = this._normalizeOfficeData(updateData);

    // Validate operating time changes (merge with existing if only one is updated)
    const opTime = normalizedUpdates.openingTime || existingOffice.openingTime;
    const clTime = normalizedUpdates.closingTime || existingOffice.closingTime;
    this._validateOperatingHours(opTime, clTime);

    // Validate duplicate name checks (merge with existing if only name/city is updated)
    const nameToCheck = normalizedUpdates.name || existingOffice.name;
    const cityToCheck = normalizedUpdates.city || existingOffice.city;
    await this._assertNoDuplicateNameInCity(nameToCheck, cityToCheck, id);

    // Exclude security / lineage updates
    delete normalizedUpdates.createdBy;
    delete normalizedUpdates.isActive;

    const updatedOffice = await officeRepository.updateOffice(id, normalizedUpdates);
    if (!updatedOffice) {
      throw new ApiError(404, "Office not found");
    }

    return updatedOffice;
  }

  /**
   * Soft delete an office branch location (Admin/Super Admin only)
   * @param {string} id 
   * @param {Object} user Requesting user context
   * @returns {Promise<Object>} The updated Office document
   */
  async deleteOffice(id, user) {
    this._verifyAdminPrivileges(user);

    const existingOffice = await officeRepository.findOfficeById(id);
    if (!existingOffice) {
      throw new ApiError(404, "Office not found");
    }

    // Business check: Prevent deleting offices with active counters (future integration)
    const activeCountersCount = 0; // Placeholder lookup value
    if (activeCountersCount > 0) {
      throw new ApiError(400, "Cannot delete an office containing active counters");
    }

    return await officeRepository.softDeleteOffice(id);
  }

  /**
   * Explicitly activate an office branch (Admin/Super Admin only)
   * @param {string} id 
   * @param {Object} user Requesting user context
   * @returns {Promise<Object>} The updated Office document
   */
  async activateOffice(id, user) {
    this._verifyAdminPrivileges(user);
    const updated = await officeRepository.updateOffice(id, { isActive: true });
    if (!updated) {
      throw new ApiError(404, "Office not found");
    }
    return updated;
  }

  /**
   * Explicitly deactivate an office branch (Admin/Super Admin only)
   * @param {string} id 
   * @param {Object} user Requesting user context
   * @returns {Promise<Object>} The updated Office document
   */
  async deactivateOffice(id, user) {
    this._verifyAdminPrivileges(user);
    const updated = await officeRepository.updateOffice(id, { isActive: false });
    if (!updated) {
      throw new ApiError(404, "Office not found");
    }
    return updated;
  }

  /**
   * Public searching wrapper returning active matching offices
   * @param {Object} options 
   * @returns {Promise<Object>} Paginated office results
   */
  async searchOffices(options = {}) {
    return await this.getAllOffices({ ...options, isActive: true });
  }

  /**
   * Fetch nearby active offices within a GPS boundary
   * @param {number} latitude 
   * @param {number} longitude 
   * @param {number} maxDistanceInMeters 
   * @param {Object} options 
   * @returns {Promise<Object>} Paginated active offices
   */
  async getNearbyOffices(latitude, longitude, maxDistanceInMeters = 5000, options = {}) {
    const queryOptions = { isActive: true, ...options };
    return await officeRepository.findNearbyOffices(latitude, longitude, maxDistanceInMeters, queryOptions);
  }
}

export default new OfficeService();
