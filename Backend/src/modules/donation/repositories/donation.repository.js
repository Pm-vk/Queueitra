import Donation from "../models/donation.model.js";
import BloodInventory from "../models/blood-inventory.model.js";
import Donor from "../../donor/models/donor.model.js";
import {
  ALLOWED_DONATION_SORT_FIELDS,
  TERMINAL_DONATION_STATUSES,
} from "../constants/donation.constants.js";

/**
 * Shared populate config for consistent field projection across all reads.
 */
const POPULATE_CONFIG = [
  { path: "donorId", select: "name email phone bloodGroup" },
  { path: "appointmentId", select: "appointmentDate timeSlot status" },
  { path: "officeId", select: "name city officeType" },
  { path: "staffId", select: "name email" },
  { path: "createdBy", select: "name email" },
];

class DonationRepository {
  // ─── Donation Queries ─────────────────────────────────────────────────────

  /**
   * Insert a new donation document.
   * @param {Object} data
   * @param {Object|null} session - Mongoose session for transactional use
   * @returns {Promise<Object>}
   */
  async createDonation(data, session = null) {
    try {
      const options = session ? { session } : {};
      const [donation] = await Donation.create([data], options);
      return await donation.populate(POPULATE_CONFIG);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a donation by ID with full population.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    try {
      return await Donation.findById(id)
        .populate(POPULATE_CONFIG)
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a donation by appointmentId.
   * Used to enforce "one donation per appointment" at application level
   * (the unique index enforces it at DB level, but we give a friendlier error here).
   * @param {string} appointmentId
   * @returns {Promise<Object|null>}
   */
  async findByAppointmentId(appointmentId) {
    try {
      return await Donation.findOne({ appointmentId }).lean().exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Paginated donation query with search, filtering, and sorting.
   *
   * Search by donor name is handled via a pre-resolved donorIds array
   * injected by the service layer.
   *
   * @param {Object} options
   * @returns {Promise<Object>} { donations, total, page, totalPages }
   */
  async findAllDonations(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        officeId,
        staffId,
        bloodGroup,
        donationType,
        status,
        dateFrom,
        dateTo,
        isActive,
        createdBy,          // CUSTOMER self-scope
        donorIds,           // Pre-resolved from search
        sortBy = "collectionTime",
        sortOrder = "desc",
      } = options;

      const filter = {};

      if (isActive !== undefined) filter.isActive = isActive;
      if (officeId) filter.officeId = officeId;
      if (staffId) filter.staffId = staffId;
      if (bloodGroup) filter.bloodGroup = bloodGroup;
      if (donationType) filter.donationType = donationType;
      if (status) filter.status = status;
      if (createdBy) filter.createdBy = createdBy;

      if (dateFrom || dateTo) {
        filter.collectionTime = {};
        if (dateFrom) filter.collectionTime.$gte = new Date(dateFrom);
        if (dateTo) filter.collectionTime.$lte = new Date(dateTo);
      }

      // Donor search results injected from service
      if (donorIds && donorIds.length > 0) {
        filter.donorId = { $in: donorIds };
      } else if (donorIds && donorIds.length === 0) {
        // Search produced no donor matches — return empty
        return { donations: [], total: 0, page: Number(page), totalPages: 0 };
      }

      const resolvedSortBy = ALLOWED_DONATION_SORT_FIELDS.includes(sortBy)
        ? sortBy
        : "collectionTime";
      const sort = { [resolvedSortBy]: sortOrder === "asc" ? 1 : -1 };
      const skip = (Number(page) - 1) * Number(limit);

      const [donations, total] = await Promise.all([
        Donation.find(filter)
          .populate(POPULATE_CONFIG)
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean()
          .exec(),
        Donation.countDocuments(filter).exec(),
      ]);

      return {
        donations,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resolve donor IDs from a name/blood group/type search term.
   * Kept in repository since it queries MongoDB.
   * @param {string} search
   * @returns {Promise<string[]>}
   */
  async resolveDonorIdsBySearch(search) {
    try {
      const donors = await Donor.find({
        name: { $regex: search, $options: "i" },
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
   * Update a donation document.
   * @param {string} id
   * @param {Object} updateData
   * @param {Object|null} session
   * @returns {Promise<Object|null>}
   */
  async updateDonation(id, updateData, session = null) {
    try {
      const options = {
        returnDocument: "after",
        runValidators: true,
        ...(session ? { session } : {}),
      };
      return await Donation.findByIdAndUpdate(
        id,
        { $set: updateData },
        options
      )
        .populate(POPULATE_CONFIG)
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Soft delete — sets isActive to false.
   * Records are never permanently deleted.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async softDeleteDonation(id) {
    try {
      return await Donation.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }

  // ─── Blood Inventory ──────────────────────────────────────────────────────

  /**
   * Create a blood inventory record inside a transaction session.
   * Always called within the completion workflow — never standalone.
   * @param {Object} data
   * @param {Object} session - Required — inventory creation is always transactional
   * @returns {Promise<Object>}
   */
  async createInventoryRecord(data, session) {
    try {
      const [record] = await BloodInventory.create([data], { session });
      return record;
    } catch (error) {
      throw error;
    }
  }
}

export default new DonationRepository();
