import staffRepository from "./staff.repository.js";
import Office from "../models/Office.js";
import ApiError from "../utils/ApiError.js";

class StaffService {
  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Ensure the requesting user holds ADMIN or SUPER_ADMIN privileges
   * @param {Object} user - req.user from protect middleware
   */
  _verifyAdminPrivileges(user) {
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      throw new ApiError(
        403,
        "Forbidden: Only ADMIN or SUPER_ADMIN can perform this action"
      );
    }
  }

  /**
   * Ensure an Office document exists for the given officeId
   * @param {string} officeId
   * @returns {Promise<Object>} The Office document
   */
  async _verifyOfficeExists(officeId) {
    const office = await Office.findById(officeId).lean().exec();
    if (!office) {
      throw new ApiError(
        404,
        `Office with ID "${officeId}" does not exist`
      );
    }
    if (!office.isActive) {
      throw new ApiError(
        400,
        "Cannot assign staff to an inactive office"
      );
    }
    return office;
  }

  /**
   * Check that no other staff member already holds the given email,
   * excluding the current staff member during updates
   * @param {string} email
   * @param {string|null} excludeStaffId
   */
  async _assertUniqueEmail(email, excludeStaffId = null) {
    const existing = await staffRepository.findByEmail(email);
    if (existing) {
      if (excludeStaffId && existing._id.toString() === excludeStaffId.toString()) {
        return; // Same record — not a conflict
      }
      throw new ApiError(400, `A staff member with email "${email}" already exists`);
    }
  }

  /**
   * Check that no other staff member already holds the given phone number,
   * excluding the current staff member during updates
   * @param {string} phone
   * @param {string|null} excludeStaffId
   */
  async _assertUniquePhone(phone, excludeStaffId = null) {
    const existing = await staffRepository.findByPhone(phone);
    if (existing) {
      if (excludeStaffId && existing._id.toString() === excludeStaffId.toString()) {
        return; // Same record — not a conflict
      }
      throw new ApiError(400, `A staff member with phone "${phone}" already exists`);
    }
  }

  // ─── Public Methods ───────────────────────────────────────────────────────

  /**
   * Create a new staff member
   * @param {Object} staffData - Validated request body
   * @param {Object} user - req.user (requesting user)
   * @returns {Promise<Object>} The created Staff document
   */
  async createStaff(staffData, user) {
    this._verifyAdminPrivileges(user);

    const { name, email, phone, designation, officeId, joiningDate } = staffData;

    // Run unique constraint checks before hitting the DB write
    await this._assertUniqueEmail(email);
    await this._assertUniquePhone(phone);

    // Verify the target office exists and is active
    await this._verifyOfficeExists(officeId);

    const newStaff = await staffRepository.createStaff({
      name: name.trim(),
      email,
      phone,
      designation: designation.trim(),
      officeId,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      createdBy: user._id,
    });

    return newStaff;
  }

  /**
   * Retrieve a single staff member by ID
   * @param {string} id
   * @returns {Promise<Object>} The Staff document
   */
  async getStaffById(id) {
    const staff = await staffRepository.findById(id);
    if (!staff) {
      throw new ApiError(404, "Staff member not found");
    }
    return staff;
  }

  /**
   * Retrieve all staff with pagination, filtering, and search
   * @param {Object} options - Query params (page, limit, officeId, isActive, designation, search, sortBy, sortOrder)
   * @returns {Promise<Object>} Paginated results
   */
  async getAllStaff(options = {}) {
    return await staffRepository.findAllStaff(options);
  }

  /**
   * Update staff details (excluding office assignment)
   * @param {string} id - Staff ID
   * @param {Object} updateData - Partial validated update payload
   * @param {Object} user - req.user (requesting user)
   * @returns {Promise<Object>} The updated Staff document
   */
  async updateStaff(id, updateData, user) {
    this._verifyAdminPrivileges(user);

    // Ensure the staff member exists
    const existing = await staffRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, "Staff member not found");
    }

    // Guard against empty update payloads
    if (!updateData || Object.keys(updateData).length === 0) {
      throw new ApiError(400, "No update fields provided");
    }

    // Run uniqueness checks only for fields being changed
    if (updateData.email && updateData.email !== existing.email) {
      await this._assertUniqueEmail(updateData.email, id);
    }
    if (updateData.phone && updateData.phone !== existing.phone) {
      await this._assertUniquePhone(updateData.phone, id);
    }

    // Trim text fields before persisting
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.designation) updateData.designation = updateData.designation.trim();

    // Convert joiningDate string to Date object if supplied
    if (updateData.joiningDate) {
      updateData.joiningDate = new Date(updateData.joiningDate);
    }

    // Prevent accidental overwrite of security / lineage fields
    delete updateData.createdBy;
    delete updateData.isActive;
    delete updateData.officeId; // handled by assignStaffToOffice

    const updated = await staffRepository.updateStaff(id, updateData);
    if (!updated) {
      throw new ApiError(404, "Staff member not found");
    }

    return updated;
  }

  /**
   * Soft delete a staff member (sets isActive to false)
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>} The updated Staff document
   */
  async deleteStaff(id, user) {
    this._verifyAdminPrivileges(user);

    const existing = await staffRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, "Staff member not found");
    }

    if (!existing.isActive) {
      throw new ApiError(400, "Staff member is already deactivated");
    }

    return await staffRepository.softDeleteStaff(id);
  }

  /**
   * Activate a staff member
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>} The updated Staff document
   */
  async activateStaff(id, user) {
    this._verifyAdminPrivileges(user);

    const existing = await staffRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, "Staff member not found");
    }

    if (existing.isActive) {
      throw new ApiError(400, "Staff member is already active");
    }

    const updated = await staffRepository.updateStaff(id, { isActive: true });
    if (!updated) {
      throw new ApiError(404, "Staff member not found");
    }

    return updated;
  }

  /**
   * Deactivate a staff member without deleting their record
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>} The updated Staff document
   */
  async deactivateStaff(id, user) {
    this._verifyAdminPrivileges(user);

    const existing = await staffRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, "Staff member not found");
    }

    if (!existing.isActive) {
      throw new ApiError(400, "Staff member is already inactive");
    }

    const updated = await staffRepository.updateStaff(id, { isActive: false });
    if (!updated) {
      throw new ApiError(404, "Staff member not found");
    }

    return updated;
  }

  /**
   * Reassign a staff member to a different office
   * @param {string} staffId
   * @param {string} officeId
   * @param {Object} user
   * @returns {Promise<Object>} The updated Staff document
   */
  async assignStaffToOffice(staffId, officeId, user) {
    this._verifyAdminPrivileges(user);

    const existing = await staffRepository.findById(staffId);
    if (!existing) {
      throw new ApiError(404, "Staff member not found");
    }

    // Prevent redundant reassignment to the same office
    if (existing.officeId && existing.officeId._id
      ? existing.officeId._id.toString() === officeId
      : existing.officeId?.toString() === officeId) {
      throw new ApiError(400, "Staff member is already assigned to this office");
    }

    // Validate target office
    await this._verifyOfficeExists(officeId);

    const updated = await staffRepository.updateStaff(staffId, { officeId });
    if (!updated) {
      throw new ApiError(404, "Staff member not found");
    }

    return updated;
  }
}

export default new StaffService();
