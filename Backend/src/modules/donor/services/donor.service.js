import donorRepository from "../repositories/donor.repository.js";
import Office from "../../../models/Office.js";
import ApiError from "../../../utils/ApiError.js";

class DonorService {
  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Calculate a person's age in whole years from their date of birth.
   * @param {Date|string} dateOfBirth
   * @returns {number} Age in years
   */
  _calculateAge(dateOfBirth) {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  }

  /**
   * Determine whether a donor meets all eligibility criteria:
   *   - Age >= 18 years
   *   - Weight >= 50 kg (if weight is provided)
   *   - isActive === true
   *
   * Weight absence does not automatically make a donor ineligible
   * (they can still be registered; eligibility is re-evaluated when weight is set).
   *
   * @param {Object} params
   * @param {Date|string} params.dateOfBirth
   * @param {number|undefined} params.weight
   * @param {boolean} params.isActive
   * @returns {boolean}
   */
  _calculateEligibility({ dateOfBirth, weight, isActive = true }) {
    if (!isActive) return false;

    const age = this._calculateAge(dateOfBirth);
    if (age < 18) return false;

    if (weight !== undefined && weight !== null && weight < 50) return false;

    return true;
  }

  /**
   * Verify ADMIN or SUPER_ADMIN privileges.
   * @param {Object} user - req.user
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
   * Verify that STAFF or higher privileges exist (excludes CUSTOMER).
   * @param {Object} user - req.user
   */
  _verifyStaffOrAbove(user) {
    const allowed = ["STAFF", "ADMIN", "SUPER_ADMIN"];
    if (!user || !allowed.includes(user.role)) {
      throw new ApiError(
        403,
        "Forbidden: You do not have permission to perform this action"
      );
    }
  }

  /**
   * Validate that an Office document exists and is active.
   * @param {string} officeId
   * @returns {Promise<Object>} The Office document
   */
  async _verifyOfficeExists(officeId) {
    const office = await Office.findById(officeId).lean().exec();
    if (!office) {
      throw new ApiError(404, `Office with ID "${officeId}" does not exist`);
    }
    if (!office.isActive) {
      throw new ApiError(400, "Cannot assign a donor to an inactive office");
    }
    return office;
  }

  /**
   * Ensure no other donor shares the given email.
   * @param {string} email
   * @param {string|null} excludeDonorId - Exclude this ID during updates
   */
  async _assertUniqueEmail(email, excludeDonorId = null) {
    if (!email) return; // Email is optional
    const existing = await donorRepository.findByEmail(email);
    if (existing) {
      if (
        excludeDonorId &&
        existing._id.toString() === excludeDonorId.toString()
      ) {
        return; // Same record — not a conflict
      }
      throw new ApiError(
        400,
        `A donor with email "${email}" already exists`
      );
    }
  }

  /**
   * Ensure no other donor shares the given phone number.
   * @param {string} phone
   * @param {string|null} excludeDonorId - Exclude this ID during updates
   */
  async _assertUniquePhone(phone, excludeDonorId = null) {
    const existing = await donorRepository.findByPhone(phone);
    if (existing) {
      if (
        excludeDonorId &&
        existing._id.toString() === excludeDonorId.toString()
      ) {
        return; // Same record — not a conflict
      }
      throw new ApiError(
        400,
        `A donor with phone "${phone}" already exists`
      );
    }
  }

  /**
   * Validate age constraint (>= 18) from dateOfBirth.
   * @param {Date|string} dateOfBirth
   */
  _validateAge(dateOfBirth) {
    const age = this._calculateAge(dateOfBirth);
    if (age < 18) {
      throw new ApiError(
        400,
        `Donor must be at least 18 years old. Calculated age: ${age}`
      );
    }
  }

  // ─── Public Service Methods ───────────────────────────────────────────────

  /**
   * Register a new donor.
   * STAFF, ADMIN, SUPER_ADMIN can create any donor.
   * CUSTOMER can register themselves (creating their own donor profile).
   *
   * @param {Object} donorData - Validated request body
   * @param {Object} user - req.user
   * @returns {Promise<Object>} The created Donor document
   */
  async createDonor(donorData, user) {
    // CUSTOMER can only register themselves; STAFF and above can register anyone
    if (user.role === "CUSTOMER") {
      // Check if this CUSTOMER already has a donor profile
      const existingProfile = await donorRepository.findByCreatedBy(user._id);
      if (existingProfile) {
        throw new ApiError(
          409,
          "You already have a registered donor profile"
        );
      }
    } else {
      this._verifyStaffOrAbove(user);
    }

    const {
      name,
      email,
      phone,
      dateOfBirth,
      gender,
      bloodGroup,
      weight,
      height,
      lastDonationDate,
      medicalConditions,
      currentMedications,
      allergies,
      address,
      city,
      state,
      country,
      pincode,
      officeId,
    } = donorData;

    // ── Business Rule Validations ────────────────────────────────────────
    this._validateAge(dateOfBirth);
    await this._assertUniqueEmail(email);
    await this._assertUniquePhone(phone);
    await this._verifyOfficeExists(officeId);

    // ── Compute Eligibility ──────────────────────────────────────────────
    const isEligible = this._calculateEligibility({
      dateOfBirth,
      weight,
      isActive: true,
    });

    const donor = await donorRepository.createDonor({
      name: name.trim(),
      email,
      phone,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      bloodGroup,
      weight,
      height,
      lastDonationDate: lastDonationDate ? new Date(lastDonationDate) : null,
      medicalConditions: medicalConditions ?? [],
      currentMedications: currentMedications ?? [],
      allergies: allergies ?? [],
      address,
      city,
      state,
      country,
      pincode,
      officeId,
      isEligible,
      createdBy: user._id,
    });

    return donor;
  }

  /**
   * Retrieve a donor by ID.
   * CUSTOMER: Can only view their own donor profile (matched by createdBy).
   * STAFF and above: Can view any donor.
   *
   * @param {string} id - Donor ID
   * @param {Object} user - req.user
   * @returns {Promise<Object>} The Donor document
   */
  async getDonorById(id, user) {
    const donor = await donorRepository.findById(id);
    if (!donor) {
      throw new ApiError(404, "Donor not found");
    }

    // CUSTOMER can only access their own profile
    if (
      user.role === "CUSTOMER" &&
      donor.createdBy._id?.toString() !== user._id.toString() &&
      donor.createdBy?.toString() !== user._id.toString()
    ) {
      throw new ApiError(
        403,
        "Forbidden: You can only view your own donor profile"
      );
    }

    return donor;
  }

  /**
   * Retrieve all donors with pagination, filtering, searching, and sorting.
   * CUSTOMER: Results are automatically scoped to their own record only.
   * STAFF and above: Full access to all records.
   *
   * @param {Object} options - Query options
   * @param {Object} user - req.user
   * @returns {Promise<Object>} Paginated donor results
   */
  async getAllDonors(options = {}, user) {
    const queryOptions = { ...options };

    // Automatically scope CUSTOMER queries to their own profile
    if (user.role === "CUSTOMER") {
      queryOptions.createdBy = user._id.toString();
    }

    return await donorRepository.findAllDonors(queryOptions);
  }

  /**
   * Update donor details.
   * CUSTOMER: Can only update their own profile.
   * STAFF: Can update any donor.
   * ADMIN, SUPER_ADMIN: Full access.
   *
   * @param {string} id - Donor ID
   * @param {Object} updateData - Partial validated payload
   * @param {Object} user - req.user
   * @returns {Promise<Object>} The updated Donor document
   */
  async updateDonor(id, updateData, user) {
    const existing = await donorRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, "Donor not found");
    }

    // Role-based access enforcement
    if (user.role === "CUSTOMER") {
      const ownerId =
        existing.createdBy?._id?.toString() ??
        existing.createdBy?.toString();
      if (ownerId !== user._id.toString()) {
        throw new ApiError(
          403,
          "Forbidden: You can only update your own donor profile"
        );
      }
    } else {
      this._verifyStaffOrAbove(user);
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new ApiError(400, "No update fields provided");
    }

    // Run uniqueness checks only for fields that changed
    if (updateData.email && updateData.email !== existing.email) {
      await this._assertUniqueEmail(updateData.email, id);
    }
    if (updateData.phone && updateData.phone !== existing.phone) {
      await this._assertUniquePhone(updateData.phone, id);
    }

    // Re-validate age if dateOfBirth is being updated
    const effectiveDOB = updateData.dateOfBirth
      ? new Date(updateData.dateOfBirth)
      : existing.dateOfBirth;

    if (updateData.dateOfBirth) {
      this._validateAge(effectiveDOB);
      updateData.dateOfBirth = effectiveDOB;
    }

    if (updateData.lastDonationDate) {
      updateData.lastDonationDate = new Date(updateData.lastDonationDate);
    }

    // Trim text fields
    if (updateData.name) updateData.name = updateData.name.trim();

    // Recalculate eligibility using the merged data
    const effectiveWeight =
      updateData.weight !== undefined ? updateData.weight : existing.weight;
    const effectiveIsActive =
      updateData.isActive !== undefined ? updateData.isActive : existing.isActive;

    updateData.isEligible = this._calculateEligibility({
      dateOfBirth: effectiveDOB,
      weight: effectiveWeight,
      isActive: effectiveIsActive,
    });

    // Strip protected fields that must not be changed via this endpoint
    delete updateData.createdBy;
    delete updateData.isActive;  // lifecycle changes use activate/deactivate
    delete updateData.officeId;  // office changes use assign-office

    const updated = await donorRepository.updateDonor(id, updateData);
    if (!updated) {
      throw new ApiError(404, "Donor not found");
    }

    return updated;
  }

  /**
   * Soft delete a donor record.
   * Records are never permanently removed.
   * ADMIN and SUPER_ADMIN only.
   *
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>} The updated Donor document
   */
  async deleteDonor(id, user) {
    this._verifyAdminPrivileges(user);

    const existing = await donorRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, "Donor not found");
    }

    if (!existing.isActive) {
      throw new ApiError(400, "Donor is already deactivated");
    }

    return await donorRepository.softDeleteDonor(id);
  }

  /**
   * Activate a donor and recalculate eligibility.
   * ADMIN and SUPER_ADMIN only.
   *
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>} The updated Donor document
   */
  async activateDonor(id, user) {
    this._verifyAdminPrivileges(user);

    const existing = await donorRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, "Donor not found");
    }

    if (existing.isActive) {
      throw new ApiError(400, "Donor is already active");
    }

    // Recalculate eligibility now that the donor is being activated
    const isEligible = this._calculateEligibility({
      dateOfBirth: existing.dateOfBirth,
      weight: existing.weight,
      isActive: true,
    });

    const updated = await donorRepository.updateDonor(id, {
      isActive: true,
      isEligible,
    });
    if (!updated) {
      throw new ApiError(404, "Donor not found");
    }

    return updated;
  }

  /**
   * Deactivate a donor (without deleting the record).
   * Sets isEligible to false while inactive.
   * ADMIN and SUPER_ADMIN only.
   *
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>} The updated Donor document
   */
  async deactivateDonor(id, user) {
    this._verifyAdminPrivileges(user);

    const existing = await donorRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, "Donor not found");
    }

    if (!existing.isActive) {
      throw new ApiError(400, "Donor is already inactive");
    }

    const updated = await donorRepository.updateDonor(id, {
      isActive: false,
      isEligible: false,
    });
    if (!updated) {
      throw new ApiError(404, "Donor not found");
    }

    return updated;
  }

  /**
   * Reassign a donor to a different office.
   * ADMIN and SUPER_ADMIN only.
   *
   * @param {string} donorId
   * @param {string} officeId
   * @param {Object} user
   * @returns {Promise<Object>} The updated Donor document
   */
  async assignDonorToOffice(donorId, officeId, user) {
    this._verifyAdminPrivileges(user);

    const existing = await donorRepository.findById(donorId);
    if (!existing) {
      throw new ApiError(404, "Donor not found");
    }

    // Prevent redundant reassignment
    const currentOfficeId =
      existing.officeId?._id?.toString() ?? existing.officeId?.toString();
    if (currentOfficeId === officeId) {
      throw new ApiError(400, "Donor is already assigned to this office");
    }

    await this._verifyOfficeExists(officeId);

    const updated = await donorRepository.updateDonor(donorId, { officeId });
    if (!updated) {
      throw new ApiError(404, "Donor not found");
    }

    return updated;
  }
}

export default new DonorService();
