import appointmentRepository from "../repositories/appointment.repository.js";
import Donor from "../../donor/models/donor.model.js";
import Office from "../../../models/Office.js";
import ApiError from "../../../utils/ApiError.js";
import {
  APPOINTMENT_STATUS,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  DEFAULT_MAX_SLOT_CAPACITY,
} from "../constants/appointment.constants.js";

class AppointmentService {
  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Convert "HH:MM" time string to total minutes since midnight.
   * @param {string} timeStr
   * @returns {number}
   */
  _timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Normalize a date to midnight UTC (date-only, strips time component).
   * Ensures date comparisons are consistent regardless of timezone.
   * @param {string|Date} date
   * @returns {Date}
   */
  _normalizeDateToMidnightUTC(date) {
    const d = new Date(date);
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    );
  }

  /**
   * Get the day name (e.g. "Monday") for a given Date in UTC.
   * @param {Date} date
   * @returns {string}
   */
  _getDayName(date) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[date.getUTCDay()];
  }

  /**
   * Verify requesting user has ADMIN or SUPER_ADMIN role.
   * @param {Object} user
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
   * Verify requesting user is STAFF, ADMIN, or SUPER_ADMIN.
   * @param {Object} user
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
   * Ensure the appointment date is not in the past.
   * Compares date-only (midnight UTC) against today's midnight UTC.
   * @param {Date} normalizedDate
   */
  _validateAppointmentDateNotPast(normalizedDate) {
    const todayUTC = this._normalizeDateToMidnightUTC(new Date());
    if (normalizedDate < todayUTC) {
      throw new ApiError(400, "Appointment date cannot be in the past");
    }
  }

  /**
   * Verify an Office exists, is active, and return it.
   * @param {string} officeId
   * @returns {Promise<Object>} The Office document
   */
  async _verifyOfficeExists(officeId) {
    const office = await Office.findById(officeId).lean().exec();
    if (!office) {
      throw new ApiError(404, `Office with ID "${officeId}" does not exist`);
    }
    if (!office.isActive) {
      throw new ApiError(400, "Cannot book an appointment at an inactive office");
    }
    return office;
  }

  /**
   * Verify a Donor exists, is active, and is eligible.
   * @param {string} donorId
   * @returns {Promise<Object>} The Donor document
   */
  async _verifyDonorEligible(donorId) {
    const donor = await Donor.findById(donorId).lean().exec();
    if (!donor) {
      throw new ApiError(404, `Donor with ID "${donorId}" does not exist`);
    }
    if (!donor.isActive) {
      throw new ApiError(400, "Cannot book an appointment for an inactive donor");
    }
    if (!donor.isEligible) {
      throw new ApiError(
        400,
        "Donor is not currently eligible to donate (age < 18 or weight < 50 kg)"
      );
    }
    return donor;
  }

  /**
   * Validate the time slot falls within office opening and closing times,
   * and that the appointment falls on a working day.
   * @param {string} timeSlot - "HH:MM"
   * @param {Object} office - Office document
   * @param {Date} appointmentDate - Normalized midnight UTC date
   */
  _validateTimeSlotAgainstOffice(timeSlot, office, appointmentDate) {
    // Working day check
    const dayName = this._getDayName(appointmentDate);
    if (!office.workingDays.includes(dayName)) {
      throw new ApiError(
        400,
        `The office is closed on ${dayName}. Working days: ${office.workingDays.join(", ")}`
      );
    }

    // Time slot within operating hours check
    const slotMinutes = this._timeToMinutes(timeSlot);
    const openMinutes = this._timeToMinutes(office.openingTime);
    const closeMinutes = this._timeToMinutes(office.closingTime);

    if (slotMinutes < openMinutes || slotMinutes >= closeMinutes) {
      throw new ApiError(
        400,
        `Time slot ${timeSlot} is outside office operating hours (${office.openingTime} – ${office.closingTime})`
      );
    }
  }

  /**
   * Enforce max appointments per slot per office.
   * @param {string} officeId
   * @param {Date} appointmentDate
   * @param {string} timeSlot
   * @param {string|null} excludeAppointmentId
   */
  async _checkSlotCapacity(officeId, appointmentDate, timeSlot, excludeAppointmentId = null) {
    const count = await appointmentRepository.countSlotBookings(
      officeId,
      appointmentDate,
      timeSlot,
      excludeAppointmentId
    );

    if (count >= DEFAULT_MAX_SLOT_CAPACITY) {
      throw new ApiError(
        409,
        `Time slot ${timeSlot} is fully booked. Maximum capacity: ${DEFAULT_MAX_SLOT_CAPACITY}`
      );
    }
  }

  /**
   * Prevent the same donor from having two active appointments at the same date+time.
   * @param {string} donorId
   * @param {Date} appointmentDate
   * @param {string} timeSlot
   * @param {string|null} excludeAppointmentId
   */
  async _checkDuplicateBooking(donorId, appointmentDate, timeSlot, excludeAppointmentId = null) {
    const duplicate = await appointmentRepository.findDuplicateBooking(
      donorId,
      appointmentDate,
      timeSlot,
      excludeAppointmentId
    );

    if (duplicate) {
      throw new ApiError(
        409,
        "This donor already has an active appointment at the selected date and time slot"
      );
    }
  }

  /**
   * Validate that the status transition is permitted by the state machine.
   * @param {string} currentStatus
   * @param {string} newStatus
   */
  _validateStatusTransition(currentStatus, newStatus) {
    if (currentStatus === newStatus) {
      throw new ApiError(400, `Appointment is already in "${currentStatus}" status`);
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus];

    if (!allowedNext || !allowedNext.includes(newStatus)) {
      throw new ApiError(
        400,
        `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${
          allowedNext?.join(", ") || "none"
        }`
      );
    }
  }

  /**
   * Build query options scoped by user role.
   * CUSTOMER: can only see their own appointments.
   * STAFF and above: full access (can additionally filter by officeId etc).
   * @param {Object} options
   * @param {Object} user
   * @returns {Object}
   */
  _applyScopeByRole(options, user) {
    const scoped = { ...options };
    if (user.role === "CUSTOMER") {
      scoped.createdBy = user._id.toString();
    }
    return scoped;
  }

  // ─── Public Service Methods ───────────────────────────────────────────────

  /**
   * Book a new appointment.
   *
   * CUSTOMER: donorId must be their own donor profile (createdBy === user._id).
   * STAFF, ADMIN, SUPER_ADMIN: can book for any eligible donor.
   *
   * @param {Object} data - Validated body
   * @param {Object} user - req.user
   * @returns {Promise<Object>} Created appointment
   */
  async createAppointment(data, user) {
    const { donorId, officeId, staffId, appointmentDate, timeSlot, remarks } = data;

    // ── Role: CUSTOMER self-booking enforcement ──────────────────────────
    if (user.role === "CUSTOMER") {
      const donor = await Donor.findById(donorId).lean().exec();
      if (!donor) {
        throw new ApiError(404, "Donor not found");
      }
      const donorOwner = donor.createdBy?.toString();
      if (donorOwner !== user._id.toString()) {
        throw new ApiError(
          403,
          "Forbidden: You can only book appointments for your own donor profile"
        );
      }
    } else {
      this._verifyStaffOrAbove(user);
    }

    // ── Business Rule Validations ────────────────────────────────────────
    const normalizedDate = this._normalizeDateToMidnightUTC(appointmentDate);
    this._validateAppointmentDateNotPast(normalizedDate);

    await this._verifyDonorEligible(donorId);
    const office = await this._verifyOfficeExists(officeId);

    this._validateTimeSlotAgainstOffice(timeSlot, office, normalizedDate);

    await this._checkDuplicateBooking(donorId, normalizedDate, timeSlot);
    await this._checkSlotCapacity(officeId, normalizedDate, timeSlot);

    return await appointmentRepository.createAppointment({
      donorId,
      officeId,
      staffId: staffId || null,
      appointmentDate: normalizedDate,
      timeSlot,
      remarks: remarks || null,
      createdBy: user._id,
      status: APPOINTMENT_STATUS.SCHEDULED,
      isActive: true,
    });
  }

  /**
   * Get a single appointment by ID.
   * CUSTOMER: own appointments only.
   * STAFF and above: any appointment.
   *
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getAppointmentById(id, user) {
    const appointment = await appointmentRepository.findById(id);
    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    if (user.role === "CUSTOMER") {
      const ownerId =
        appointment.createdBy?._id?.toString() ??
        appointment.createdBy?.toString();
      if (ownerId !== user._id.toString()) {
        throw new ApiError(
          403,
          "Forbidden: You can only view your own appointments"
        );
      }
    }

    return appointment;
  }

  /**
   * Get all appointments with full filtering, search, sorting, and pagination.
   * @param {Object} options
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getAllAppointments(options = {}, user) {
    const scopedOptions = this._applyScopeByRole(options, user);

    // Resolve donor IDs from search term before querying appointments
    if (options.search) {
      if (user.role === "CUSTOMER") {
        // CUSTOMER search is already scoped by createdBy — skip donor search
        delete scopedOptions.search;
      } else {
        const donorIds = await appointmentRepository.resolveDonorIdsBySearch(
          options.search
        );
        scopedOptions.donorIds = donorIds;
        delete scopedOptions.search;
      }
    }

    return await appointmentRepository.findAllAppointments(scopedOptions);
  }

  /**
   * Get upcoming appointments (date >= today, active statuses).
   * @param {Object} options
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getUpcomingAppointments(options = {}, user) {
    const today = this._normalizeDateToMidnightUTC(new Date());

    return await this.getAllAppointments(
      {
        ...options,
        dateFrom: today.toISOString(),
        statusIn: ACTIVE_STATUSES,
        // Override any conflicting status filter
        status: undefined,
      },
      user
    );
  }

  /**
   * Get today's appointments only.
   * @param {Object} options
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getTodaysAppointments(options = {}, user) {
    const today = this._normalizeDateToMidnightUTC(new Date());

    return await this.getAllAppointments(
      {
        ...options,
        appointmentDate: today.toISOString(),
        status: undefined,
      },
      user
    );
  }

  /**
   * Get appointment history (terminal statuses: COMPLETED, CANCELLED, NO_SHOW).
   * @param {Object} options
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getAppointmentHistory(options = {}, user) {
    return await this.getAllAppointments(
      {
        ...options,
        statusIn: TERMINAL_STATUSES,
        status: undefined,
      },
      user
    );
  }

  /**
   * Update general appointment fields (remarks, staffId).
   * ADMIN and SUPER_ADMIN only. Does NOT update status or appointment date.
   *
   * @param {string} id
   * @param {Object} data
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async updateAppointment(id, data, user) {
    this._verifyAdminPrivileges(user);

    const existing = await appointmentRepository.findById(id);
    if (!existing) throw new ApiError(404, "Appointment not found");

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new ApiError(
        400,
        `Cannot update a ${existing.status} appointment`
      );
    }

    if (!data || Object.keys(data).length === 0) {
      throw new ApiError(400, "No update fields provided");
    }

    const updated = await appointmentRepository.updateAppointment(id, data);
    if (!updated) throw new ApiError(404, "Appointment not found");
    return updated;
  }

  /**
   * Update appointment status (advance through state machine).
   *
   * CUSTOMER: can only cancel their own appointment.
   * STAFF: can advance status (SCHEDULED→CONFIRMED, CONFIRMED→CHECKED_IN, etc.)
   *        or cancel. Can assign themselves as staffId.
   * ADMIN, SUPER_ADMIN: full status control.
   *
   * @param {string} id
   * @param {string} newStatus
   * @param {Object} user
   * @param {string|null} remarks
   * @returns {Promise<Object>}
   */
  async updateAppointmentStatus(id, newStatus, user, remarks = null) {
    const existing = await appointmentRepository.findById(id);
    if (!existing) throw new ApiError(404, "Appointment not found");

    // CUSTOMER: can only cancel their own
    if (user.role === "CUSTOMER") {
      const ownerId =
        existing.createdBy?._id?.toString() ??
        existing.createdBy?.toString();
      if (ownerId !== user._id.toString()) {
        throw new ApiError(
          403,
          "Forbidden: You can only cancel your own appointments"
        );
      }
      if (newStatus !== APPOINTMENT_STATUS.CANCELLED) {
        throw new ApiError(
          403,
          "Forbidden: You can only cancel your appointment"
        );
      }
    } else {
      this._verifyStaffOrAbove(user);
    }

    this._validateStatusTransition(existing.status, newStatus);

    const updateData = { status: newStatus };
    if (remarks !== undefined && remarks !== null) {
      updateData.remarks = remarks;
    }

    // Soft-delete flag when appointment reaches a terminal state
    if (
      newStatus === APPOINTMENT_STATUS.CANCELLED ||
      newStatus === APPOINTMENT_STATUS.NO_SHOW
    ) {
      updateData.isActive = false;
    }

    const updated = await appointmentRepository.updateAppointment(id, updateData);
    if (!updated) throw new ApiError(404, "Appointment not found");
    return updated;
  }

  /**
   * Cancel an appointment (CUSTOMER own, STAFF/ADMIN any).
   * Convenience wrapper around updateAppointmentStatus.
   * @param {string} id
   * @param {Object} user
   * @param {string|null} remarks
   * @returns {Promise<Object>}
   */
  async cancelAppointment(id, user, remarks = null) {
    return await this.updateAppointmentStatus(
      id,
      APPOINTMENT_STATUS.CANCELLED,
      user,
      remarks
    );
  }

  /**
   * Reschedule — move appointment to a new date and/or time slot.
   * Runs full validation (date not past, office hours, capacity, duplicates).
   * ADMIN and SUPER_ADMIN only; appointment must be in an active status.
   *
   * @param {string} id
   * @param {Object} data - { appointmentDate?, timeSlot?, remarks? }
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async rescheduleAppointment(id, data, user) {
    this._verifyAdminPrivileges(user);

    const existing = await appointmentRepository.findById(id);
    if (!existing) throw new ApiError(404, "Appointment not found");

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new ApiError(
        400,
        `Cannot reschedule a ${existing.status} appointment`
      );
    }

    // Merge: use new values where provided, fall back to existing
    const newDate = data.appointmentDate
      ? this._normalizeDateToMidnightUTC(data.appointmentDate)
      : new Date(existing.appointmentDate);

    const newSlot = data.timeSlot || existing.timeSlot;

    // Re-run all booking validations with the new values
    this._validateAppointmentDateNotPast(newDate);

    const officeId =
      existing.officeId?._id?.toString() ?? existing.officeId?.toString();
    const office = await this._verifyOfficeExists(officeId);
    this._validateTimeSlotAgainstOffice(newSlot, office, newDate);

    const donorId =
      existing.donorId?._id?.toString() ?? existing.donorId?.toString();

    await this._checkDuplicateBooking(donorId, newDate, newSlot, id);
    await this._checkSlotCapacity(officeId, newDate, newSlot, id);

    const updateData = {
      appointmentDate: newDate,
      timeSlot: newSlot,
      // Revert to SCHEDULED after reschedule regardless of current status
      status: APPOINTMENT_STATUS.SCHEDULED,
    };

    if (data.remarks !== undefined) updateData.remarks = data.remarks;

    const updated = await appointmentRepository.updateAppointment(id, updateData);
    if (!updated) throw new ApiError(404, "Appointment not found");
    return updated;
  }

  /**
   * Assign a staff member (User with STAFF role) to an appointment.
   *
   * STAFF: can only assign themselves (staffId must equal req.user._id).
   * ADMIN, SUPER_ADMIN: can assign any user.
   *
   * @param {string} id
   * @param {string} staffId
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async assignStaff(id, staffId, user) {
    this._verifyStaffOrAbove(user);

    // STAFF can only assign themselves
    if (
      user.role === "STAFF" &&
      staffId !== user._id.toString()
    ) {
      throw new ApiError(
        403,
        "Forbidden: STAFF can only assign themselves to an appointment"
      );
    }

    const existing = await appointmentRepository.findById(id);
    if (!existing) throw new ApiError(404, "Appointment not found");

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new ApiError(
        400,
        `Cannot assign staff to a ${existing.status} appointment`
      );
    }

    const updated = await appointmentRepository.updateAppointment(id, { staffId });
    if (!updated) throw new ApiError(404, "Appointment not found");
    return updated;
  }
}

export default new AppointmentService();
