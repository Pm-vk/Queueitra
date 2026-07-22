import Appointment from "../models/appointment.model.js";
import Donor from "../../donor/models/donor.model.js";
import {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  ALLOWED_SORT_FIELDS,
} from "../constants/appointment.constants.js";

/**
 * Shared populate configuration — keeps field projection consistent
 * across all read queries.
 */
const POPULATE_CONFIG = [
  { path: "donorId", select: "name email phone bloodGroup" },
  { path: "officeId", select: "name city officeType openingTime closingTime" },
  { path: "staffId", select: "name email" },
  { path: "createdBy", select: "name email" },
];

class AppointmentRepository {
  /**
   * Insert a new appointment document
   * @param {Object} data
   * @returns {Promise<Object>} Created appointment (populated)
   */
  async createAppointment(data) {
    try {
      const appointment = await Appointment.create(data);
      return await appointment.populate(POPULATE_CONFIG);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find appointment by ID with full population
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    try {
      return await Appointment.findById(id)
        .populate(POPULATE_CONFIG)
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Count existing ACTIVE appointments for a specific office + date + timeSlot.
   * Used for slot capacity enforcement.
   * @param {string} officeId
   * @param {Date} appointmentDate
   * @param {string} timeSlot
   * @param {string|null} excludeAppointmentId - Exclude during reschedule checks
   * @returns {Promise<number>}
   */
  async countSlotBookings(officeId, appointmentDate, timeSlot, excludeAppointmentId = null) {
    try {
      const filter = {
        officeId,
        appointmentDate,
        timeSlot,
        status: { $in: ACTIVE_STATUSES },
      };

      if (excludeAppointmentId) {
        filter._id = { $ne: excludeAppointmentId };
      }

      return await Appointment.countDocuments(filter).exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if a donor already has an active appointment at the same date + time.
   * The partial unique index on the model also enforces this at DB level,
   * but checking here gives a friendlier error message.
   * @param {string} donorId
   * @param {Date} appointmentDate
   * @param {string} timeSlot
   * @param {string|null} excludeAppointmentId
   * @returns {Promise<Object|null>}
   */
  async findDuplicateBooking(donorId, appointmentDate, timeSlot, excludeAppointmentId = null) {
    try {
      const filter = {
        donorId,
        appointmentDate,
        timeSlot,
        status: { $in: ACTIVE_STATUSES },
      };

      if (excludeAppointmentId) {
        filter._id = { $ne: excludeAppointmentId };
      }

      return await Appointment.findOne(filter).lean().exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Paginated appointment query with search, filtering, and sorting.
   *
   * Search by donor name/phone/email is handled via a pre-lookup of Donor IDs
   * so the Appointment collection is not burdened with denormalized fields.
   *
   * @param {Object} options
   * @returns {Promise<Object>} { appointments, total, page, totalPages }
   */
  async findAllAppointments(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        officeId,
        staffId,
        status,
        dateFrom,
        dateTo,
        appointmentDate,
        isActive,
        statusIn,       // Array of statuses — used internally for upcoming/history
        createdBy,      // Used for CUSTOMER self-scope
        donorIds,       // Pre-resolved from donor search — injected by service
        sortBy = "appointmentDate",
        sortOrder = "asc",
      } = options;

      const filter = {};

      // ── Filters ──────────────────────────────────────────────────────────

      if (isActive !== undefined) filter.isActive = isActive;
      if (officeId) filter.officeId = officeId;
      if (staffId) filter.staffId = staffId;
      if (createdBy) filter.createdBy = createdBy;

      // Single status filter
      if (status) filter.status = status;

      // Multiple statuses filter (used for upcoming/history)
      if (statusIn && statusIn.length > 0) {
        filter.status = { $in: statusIn };
      }

      // Exact date filter
      if (appointmentDate) {
        filter.appointmentDate = new Date(appointmentDate);
      }

      // Date range filter
      if (dateFrom || dateTo) {
        filter.appointmentDate = {};
        if (dateFrom) filter.appointmentDate.$gte = new Date(dateFrom);
        if (dateTo) filter.appointmentDate.$lte = new Date(dateTo);
      }

      // Donor IDs resolved from name/phone/email search
      if (donorIds && donorIds.length > 0) {
        filter.donorId = { $in: donorIds };
      } else if (donorIds && donorIds.length === 0) {
        // Search returned no matching donors — return empty result
        return { appointments: [], total: 0, page: Number(page), totalPages: 0 };
      }

      // ── Sort ──────────────────────────────────────────────────────────────
      const resolvedSortBy = ALLOWED_SORT_FIELDS.includes(sortBy)
        ? sortBy
        : "appointmentDate";
      const sort = { [resolvedSortBy]: sortOrder === "desc" ? -1 : 1 };

      const skip = (Number(page) - 1) * Number(limit);

      const [appointments, total] = await Promise.all([
        Appointment.find(filter)
          .populate(POPULATE_CONFIG)
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean()
          .exec(),
        Appointment.countDocuments(filter).exec(),
      ]);

      return {
        appointments,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resolve donor IDs from a search term (name, email, or phone).
   * Kept in repository since it queries MongoDB, but on the Donor collection.
   * @param {string} search
   * @returns {Promise<string[]>} Array of matching donor ObjectId strings
   */
  async resolveDonorIdsBySearch(search) {
    try {
      const searchRegex = { $regex: search, $options: "i" };
      const donors = await Donor.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      })
        .select("_id")
        .lean()
        .exec();

      return donors.map((d) => d._id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update appointment by ID
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object|null>} Updated appointment (populated)
   */
  async updateAppointment(id, updateData) {
    try {
      return await Appointment.findByIdAndUpdate(
        id,
        { $set: updateData },
        { returnDocument: "after", runValidators: true }
      )
        .populate(POPULATE_CONFIG)
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Soft delete an appointment (sets isActive=false, status=CANCELLED).
   * Records are never permanently removed.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async softDeleteAppointment(id) {
    try {
      return await Appointment.findByIdAndUpdate(
        id,
        { $set: { isActive: false, status: "CANCELLED" } },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }
}

export default new AppointmentRepository();
