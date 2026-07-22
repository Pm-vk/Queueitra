import mongoose from "mongoose";
import donationRepository from "../repositories/donation.repository.js";
import Donor from "../../donor/models/donor.model.js";
import Appointment from "../../appointment/models/appointment.model.js";
import Office from "../../../models/Office.js";
import User from "../../../models/User.js";
import ApiError from "../../../utils/ApiError.js";
import {
  DONATION_STATUS,
  TERMINAL_DONATION_STATUSES,
  ALLOWED_DONATION_STATUS_TRANSITIONS,
  BLOOD_EXPIRY_DAYS,
  INVENTORY_STATUS,
} from "../constants/donation.constants.js";
import { validateAllVitals } from "../utils/donation.utils.js";

class DonationService {
  // ─── Private Helpers ─────────────────────────────────────────────────────

  _verifyAdminPrivileges(user) {
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      throw new ApiError(
        403,
        "Forbidden: Only ADMIN or SUPER_ADMIN can perform this action"
      );
    }
  }

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
   * Calculate donor age from dateOfBirth.
   * @param {Date} dateOfBirth
   * @returns {number}
   */
  _calculateAge(dateOfBirth) {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  /**
   * Recalculate donor eligibility: age >= 18, weight >= 50, isActive.
   * Inlined here to avoid circular imports with the donor service.
   * @param {Object} donor
   * @returns {boolean}
   */
  _calculateDonorEligibility(donor) {
    if (!donor.isActive) return false;
    if (this._calculateAge(donor.dateOfBirth) < 18) return false;
    if (donor.weight !== undefined && donor.weight !== null && donor.weight < 50) return false;
    return true;
  }

  /**
   * Validate the donation status transition is permitted.
   * @param {string} current
   * @param {string} next
   */
  _validateStatusTransition(current, next) {
    if (current === next) {
      throw new ApiError(400, `Donation is already in "${current}" status`);
    }
    const allowed = ALLOWED_DONATION_STATUS_TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw new ApiError(
        400,
        `Cannot transition from "${current}" to "${next}". ` +
          `Allowed: ${allowed?.join(", ") || "none (terminal status)"}`
      );
    }
  }

  /**
   * Verify a Donor exists and is active + eligible.
   * @param {string} donorId
   * @returns {Promise<Object>} Donor document
   */
  async _verifyDonorEligible(donorId) {
    const donor = await Donor.findById(donorId).lean().exec();
    if (!donor) throw new ApiError(404, `Donor with ID "${donorId}" not found`);
    if (!donor.isActive) throw new ApiError(400, "Donor is inactive and cannot donate");
    if (!donor.isEligible) {
      throw new ApiError(
        400,
        "Donor is not currently eligible to donate (age < 18 or weight < 50 kg)"
      );
    }
    return donor;
  }

  /**
   * Verify an Office exists and is active.
   * @param {string} officeId
   * @returns {Promise<Object>} Office document
   */
  async _verifyOfficeExists(officeId) {
    const office = await Office.findById(officeId).lean().exec();
    if (!office) throw new ApiError(404, `Office with ID "${officeId}" not found`);
    if (!office.isActive) throw new ApiError(400, "Office is inactive");
    return office;
  }

  /**
   * Verify a Staff user exists and has the STAFF (or above) role.
   * @param {string} staffId
   * @returns {Promise<Object>} User document
   */
  async _verifyStaffExists(staffId) {
    const staff = await User.findById(staffId).lean().exec();
    if (!staff) throw new ApiError(404, `Staff user with ID "${staffId}" not found`);
    if (!["STAFF", "ADMIN", "SUPER_ADMIN"].includes(staff.role)) {
      throw new ApiError(400, `User "${staffId}" does not have a STAFF or above role`);
    }
    return staff;
  }

  /**
   * Verify the Appointment exists, belongs to the donor + office,
   * and is in a bookable state (not already COMPLETED, CANCELLED, etc.).
   *
   * @param {string} appointmentId
   * @param {string} donorId
   * @param {string} officeId
   * @returns {Promise<Object>} Appointment document
   */
  async _verifyAppointment(appointmentId, donorId, officeId) {
    const appointment = await Appointment.findById(appointmentId).lean().exec();

    if (!appointment) {
      throw new ApiError(404, `Appointment with ID "${appointmentId}" not found`);
    }

    // Donor ownership check
    if (appointment.donorId.toString() !== donorId) {
      throw new ApiError(
        400,
        "Appointment does not belong to the specified donor"
      );
    }

    // Office ownership check
    if (appointment.officeId.toString() !== officeId) {
      throw new ApiError(
        400,
        "Appointment does not belong to the specified office"
      );
    }

    // Status check — cannot create donation for a completed/cancelled appointment
    const BLOCKED_STATUSES = ["COMPLETED", "CANCELLED", "NO_SHOW"];
    if (BLOCKED_STATUSES.includes(appointment.status)) {
      throw new ApiError(
        400,
        `Cannot create a donation for a ${appointment.status} appointment`
      );
    }

    // Date check — donation cannot happen before the appointment date
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const appointmentDateUTC = new Date(appointment.appointmentDate);
    appointmentDateUTC.setUTCHours(0, 0, 0, 0);

    if (today < appointmentDateUTC) {
      throw new ApiError(
        400,
        "Donation cannot be recorded before the appointment date"
      );
    }

    return appointment;
  }

  /**
   * Atomically execute the COMPLETED workflow inside a MongoDB transaction:
   *   1. Update donation → COMPLETED + completedAt
   *   2. Update appointment → COMPLETED
   *   3. Update donor.lastDonationDate
   *   4. Recalculate and update donor.isEligible
   *   5. Create BloodInventory record
   *   6. Commit
   * Rolls back everything on any failure.
   *
   * @param {string} donationId
   * @param {Object} donation - Current donation document (lean)
   * @param {Object} completionData - { completedAt, remarks }
   * @returns {Promise<Object>} Updated donation document
   */
  async _executeCompletionWorkflow(donationId, donation, completionData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const now = completionData.completedAt
        ? new Date(completionData.completedAt)
        : new Date();

      // ── Step 1: Mark donation COMPLETED ──────────────────────────────────
      const updatedDonation = await donationRepository.updateDonation(
        donationId,
        {
          status: DONATION_STATUS.COMPLETED,
          completedAt: now,
          ...(completionData.remarks !== undefined
            ? { remarks: completionData.remarks }
            : {}),
        },
        session
      );

      // ── Step 2: Mark linked appointment COMPLETED ─────────────────────────
      await Appointment.findByIdAndUpdate(
        donation.appointmentId,
        { $set: { status: "COMPLETED", isActive: false } },
        { session }
      );

      // ── Step 3 & 4: Update donor lastDonationDate + recalculate eligibility ──
      const donor = await Donor.findById(donation.donorId).session(session).lean();
      const isEligible = this._calculateDonorEligibility(donor);

      await Donor.findByIdAndUpdate(
        donation.donorId,
        {
          $set: {
            lastDonationDate: now,
            isEligible,
          },
        },
        { session }
      );

      // ── Step 5: Create BloodInventory record ──────────────────────────────
      const expiryDays = BLOOD_EXPIRY_DAYS[donation.donationType] ?? 42;
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      await donationRepository.createInventoryRecord(
        {
          donationId,
          donorId: donation.donorId,
          officeId: donation.officeId,
          bloodGroup: donation.bloodGroup,
          donationType: donation.donationType,
          volume: donation.volume,
          collectedAt: now,
          expiresAt,
          status: INVENTORY_STATUS.AVAILABLE,
          isActive: true,
        },
        session
      );

      // ── Commit ────────────────────────────────────────────────────────────
      await session.commitTransaction();

      return updatedDonation;
    } catch (error) {
      await session.abortTransaction();
      // Re-throw with context for easier debugging
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── Public Service Methods ───────────────────────────────────────────────

  /**
   * Create a new donation record.
   * Validates all cross-document business rules before persisting.
   * STAFF, ADMIN, SUPER_ADMIN only.
   *
   * @param {Object} data - Validated request body
   * @param {Object} user - req.user
   * @returns {Promise<Object>} Created donation
   */
  async createDonation(data, user) {
    this._verifyStaffOrAbove(user);

    const {
      donorId,
      appointmentId,
      officeId,
      staffId,
      bloodGroup,
      donationType,
      volume,
      hemoglobinLevel,
      bloodPressure,
      pulse,
      temperature,
      weight,
      remarks,
      collectionTime,
    } = data;

    // ── Cross-document validations ────────────────────────────────────────
    await this._verifyDonorEligible(donorId);
    await this._verifyOfficeExists(officeId);
    await this._verifyStaffExists(staffId);
    await this._verifyAppointment(appointmentId, donorId, officeId);

    // ── Duplicate appointment check ───────────────────────────────────────
    const existing = await donationRepository.findByAppointmentId(appointmentId);
    if (existing) {
      throw new ApiError(
        409,
        "A donation record already exists for this appointment"
      );
    }

    // ── Vital signs validation ────────────────────────────────────────────
    validateAllVitals(
      { volume, hemoglobinLevel, bloodPressure, pulse, temperature, weight },
      donationType
    );

    return await donationRepository.createDonation({
      donorId,
      appointmentId,
      officeId,
      staffId,
      bloodGroup,
      donationType,
      volume,
      hemoglobinLevel,
      bloodPressure,
      pulse,
      temperature,
      weight,
      remarks: remarks ?? null,
      collectionTime: collectionTime ? new Date(collectionTime) : new Date(),
      status: DONATION_STATUS.SCHEDULED,
      createdBy: user._id,
      isActive: true,
    });
  }

  /**
   * Get a single donation by ID.
   * CUSTOMER: own records only (matched by createdBy).
   * STAFF and above: any donation.
   *
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getDonationById(id, user) {
    const donation = await donationRepository.findById(id);
    if (!donation) throw new ApiError(404, "Donation not found");

    if (user.role === "CUSTOMER") {
      const ownerId =
        donation.createdBy?._id?.toString() ?? donation.createdBy?.toString();
      if (ownerId !== user._id.toString()) {
        throw new ApiError(403, "Forbidden: You can only view your own donation records");
      }
    }

    return donation;
  }

  /**
   * Get all donations with pagination, filtering, search, and sorting.
   * CUSTOMER: scoped to own records.
   *
   * @param {Object} options
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getAllDonations(options = {}, user) {
    const queryOptions = { ...options };

    if (user.role === "CUSTOMER") {
      queryOptions.createdBy = user._id.toString();
      delete queryOptions.search; // CUSTOMER search is scoped by createdBy already
    } else if (options.search) {
      // Resolve donor IDs from name search for non-CUSTOMER users
      const donorIds = await donationRepository.resolveDonorIdsBySearch(
        options.search
      );
      queryOptions.donorIds = donorIds;
      delete queryOptions.search;

      // bloodGroup and donationType can also be used as search terms —
      // they are handled as direct filters below (already in options)
    }

    return await donationRepository.findAllDonations(queryOptions);
  }

  /**
   * Get donation history for the authenticated user.
   * Completed, Failed, and Rejected donations.
   *
   * @param {Object} options
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getDonationHistory(options = {}, user) {
    return await this.getAllDonations(
      { ...options, status: undefined, statusIn: TERMINAL_DONATION_STATUSES },
      user
    );
  }

  /**
   * Update general donation fields (vitals, remarks, staffId).
   * Does NOT update status — use updateDonationStatus.
   * ADMIN and SUPER_ADMIN only.
   *
   * @param {string} id
   * @param {Object} data
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async updateDonation(id, data, user) {
    this._verifyAdminPrivileges(user);

    const existing = await donationRepository.findById(id);
    if (!existing) throw new ApiError(404, "Donation not found");

    if (TERMINAL_DONATION_STATUSES.includes(existing.status)) {
      throw new ApiError(
        400,
        `Cannot update a ${existing.status} donation`
      );
    }

    if (!data || Object.keys(data).length === 0) {
      throw new ApiError(400, "No update fields provided");
    }

    // Re-validate vitals with merged data
    const effectiveDonationType = data.donationType || existing.donationType;
    validateAllVitals(
      {
        volume: data.volume ?? existing.volume,
        hemoglobinLevel: data.hemoglobinLevel,
        bloodPressure: data.bloodPressure,
        pulse: data.pulse,
        temperature: data.temperature,
        weight: data.weight,
      },
      effectiveDonationType
    );

    if (data.collectionTime) data.collectionTime = new Date(data.collectionTime);

    const updated = await donationRepository.updateDonation(id, data);
    if (!updated) throw new ApiError(404, "Donation not found");
    return updated;
  }

  /**
   * Update donation status, enforcing the state machine.
   * When status → COMPLETED, executes the full transactional workflow.
   *
   * CUSTOMER: no access (donations are managed by STAFF/ADMIN).
   * STAFF: can advance status.
   * ADMIN/SUPER_ADMIN: full control.
   *
   * @param {string} id
   * @param {string} newStatus
   * @param {Object} user
   * @param {string|null} remarks
   * @param {string|null} completedAt
   * @returns {Promise<Object>}
   */
  async updateDonationStatus(id, newStatus, user, remarks = null, completedAt = null) {
    this._verifyStaffOrAbove(user);

    const existing = await donationRepository.findById(id);
    if (!existing) throw new ApiError(404, "Donation not found");

    this._validateStatusTransition(existing.status, newStatus);

    // ── COMPLETED: Run the full atomic workflow ───────────────────────────
    if (newStatus === DONATION_STATUS.COMPLETED) {
      return await this._executeCompletionWorkflow(id, existing, {
        remarks,
        completedAt,
      });
    }

    // ── Other transitions: simple update ─────────────────────────────────
    const updateData = { status: newStatus };
    if (remarks !== undefined && remarks !== null) updateData.remarks = remarks;

    // Soft-delete on failure/rejection for clean active-only queries
    if (
      newStatus === DONATION_STATUS.FAILED ||
      newStatus === DONATION_STATUS.REJECTED
    ) {
      updateData.isActive = false;
    }

    const updated = await donationRepository.updateDonation(id, updateData);
    if (!updated) throw new ApiError(404, "Donation not found");
    return updated;
  }

  /**
   * Soft delete a donation record.
   * ADMIN and SUPER_ADMIN only. Cannot delete a COMPLETED donation.
   *
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async deleteDonation(id, user) {
    this._verifyAdminPrivileges(user);

    const existing = await donationRepository.findById(id);
    if (!existing) throw new ApiError(404, "Donation not found");

    if (existing.status === DONATION_STATUS.COMPLETED) {
      throw new ApiError(
        400,
        "Completed donations cannot be deleted. They are permanent records."
      );
    }

    if (!existing.isActive) {
      throw new ApiError(400, "Donation is already inactive");
    }

    return await donationRepository.softDeleteDonation(id);
  }
}

export default new DonationService();
