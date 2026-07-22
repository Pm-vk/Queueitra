import mongoose from "mongoose";
import BloodRequest from "../models/bloodRequest.model.js";
import {
  ALLOWED_REQUEST_SORT_FIELDS,
  REQUEST_STATUS,
} from "../constants/bloodRequest.constants.js";

/**
 * Shared populate config for consistent field projection across all reads.
 */
const POPULATE_CONFIG = [
  { path: "officeId", select: "name city officeType" },
  { path: "requestedBy", select: "name email" },
  { path: "approvedBy", select: "name email" },
  { path: "createdBy", select: "name email" },
  {
    path: "allocatedUnits",
    select: "bloodUnitId bloodGroup componentType volume status expiryDate storageLocation",
  },
];

class BloodRequestRepository {
  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Insert a new BloodRequest document.
   * @param {Object} data
   * @returns {Promise<Object>} Created request (populated)
   */
  async createRequest(data) {
    try {
      const request = await BloodRequest.create(data);
      return await request.populate(POPULATE_CONFIG);
    } catch (error) {
      throw error;
    }
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  /**
   * Find a single request by MongoDB ObjectId.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    try {
      return await BloodRequest.findById(id)
        .populate(POPULATE_CONFIG)
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a single request by the human-readable requestNumber.
   * @param {string} requestNumber
   * @returns {Promise<Object|null>}
   */
  async findByRequestNumber(requestNumber) {
    try {
      return await BloodRequest.findOne({
        requestNumber: requestNumber.toUpperCase(),
      })
        .populate(POPULATE_CONFIG)
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Paginated blood request query with search, filtering, and sorting.
   *
   * @param {Object} options
   * @returns {Promise<Object>} { requests, total, page, totalPages }
   */
  async findAllRequests(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        officeId,
        bloodGroup,
        componentType,
        priority,
        status,
        dateFrom,
        dateTo,
        isActive,
        createdBy,          // STAFF self-scope
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const filter = {};

      if (isActive !== undefined) filter.isActive = isActive;
      if (officeId) filter.officeId = officeId;
      if (bloodGroup) filter.bloodGroup = bloodGroup;
      if (componentType) filter.componentType = componentType;
      if (priority) filter.priority = priority;
      if (status) filter.status = status;
      if (createdBy) filter.createdBy = createdBy;

      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }

      // Search: requestNumber, hospitalName, patientName, doctorName via regex
      // (Falls back gracefully if text index is not available)
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        filter.$or = [
          { requestNumber: searchRegex },
          { hospitalName: searchRegex },
          { patientName: searchRegex },
          { doctorName: searchRegex },
        ];
      }

      const resolvedSortBy = ALLOWED_REQUEST_SORT_FIELDS.includes(sortBy)
        ? sortBy
        : "createdAt";
      const sort = { [resolvedSortBy]: sortOrder === "asc" ? 1 : -1 };
      const skip = (Number(page) - 1) * Number(limit);

      const [requests, total] = await Promise.all([
        BloodRequest.find(filter)
          .populate(POPULATE_CONFIG)
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean()
          .exec(),
        BloodRequest.countDocuments(filter).exec(),
      ]);

      return {
        requests,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      };
    } catch (error) {
      throw error;
    }
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Update a blood request document.
   * @param {string} id
   * @param {Object} updateData
   * @param {Object|null} session - Mongoose session for transactional use
   * @returns {Promise<Object|null>} Updated request (populated)
   */
  async updateRequest(id, updateData, session = null) {
    try {
      const options = {
        returnDocument: "after",
        runValidators: true,
        ...(session ? { session } : {}),
      };
      return await BloodRequest.findByIdAndUpdate(
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
   * Append allocated unit IDs to the request's allocatedUnits array.
   * Used within the allocation transaction.
   *
   * @param {string} id
   * @param {string[]} unitIds - InventoryUnit ObjectIds to append
   * @param {Object} additionalUpdate - Additional $set fields (status, fulfilledAt)
   * @param {Object|null} session
   * @returns {Promise<Object|null>}
   */
  async appendAllocatedUnits(id, unitIds, additionalUpdate = {}, session = null) {
    try {
      const options = {
        returnDocument: "after",
        ...(session ? { session } : {}),
      };
      return await BloodRequest.findByIdAndUpdate(
        id,
        {
          $push: { allocatedUnits: { $each: unitIds } },
          $set: additionalUpdate,
        },
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
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async softDeleteRequest(id) {
    try {
      return await BloodRequest.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { returnDocument: "after" }
      ).exec();
    } catch (error) {
      throw error;
    }
  }

  // ─── Dashboard Aggregation ────────────────────────────────────────────────

  /**
   * Aggregation pipeline for the blood request dashboard.
   * Uses $facet for a single round-trip to compute all stats.
   *
   * @param {string|null} officeId
   * @returns {Promise<Object>}
   */
  async getDashboardAggregation(officeId = null) {
    try {
      const matchStage = { isActive: true };
      if (officeId) {
        matchStage.officeId = new mongoose.Types.ObjectId(officeId);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $facet: {
            // ── Total count ──────────────────────────────────────────────
            total: [{ $count: "count" }],

            // ── Per-status counts ────────────────────────────────────────
            statusSummary: [
              { $group: { _id: "$status", count: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ],

            // ── Emergency requests (pending or approved) ─────────────────
            emergencyRequests: [
              {
                $match: {
                  priority: "EMERGENCY",
                  status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
                },
              },
              { $sort: { requiredBefore: 1 } },
              { $limit: 20 },
              {
                $project: {
                  requestNumber: 1,
                  hospitalName: 1,
                  patientName: 1,
                  bloodGroup: 1,
                  componentType: 1,
                  unitsRequested: 1,
                  requiredBefore: 1,
                  status: 1,
                },
              },
            ],

            // ── Average fulfillment time (ms → minutes) ──────────────────
            avgFulfillmentTime: [
              {
                $match: {
                  status: REQUEST_STATUS.FULFILLED,
                  fulfilledAt: { $exists: true, $ne: null },
                },
              },
              {
                $project: {
                  durationMs: { $subtract: ["$fulfilledAt", "$createdAt"] },
                },
              },
              {
                $group: {
                  _id: null,
                  avgDurationMs: { $avg: "$durationMs" },
                  totalFulfilled: { $sum: 1 },
                },
              },
            ],

            // ── Office-wise request distribution ─────────────────────────
            officeWise: [
              {
                $group: {
                  _id: "$officeId",
                  total: { $sum: 1 },
                  pending: {
                    $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
                  },
                  fulfilled: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "FULFILLED"] }, 1, 0],
                    },
                  },
                },
              },
            ],

            // ── Blood group demand distribution ──────────────────────────
            bloodGroupDemand: [
              {
                $group: {
                  _id: "$bloodGroup",
                  totalRequests: { $sum: 1 },
                  totalUnitsRequested: { $sum: "$unitsRequested" },
                },
              },
              { $sort: { totalUnitsRequested: -1 } },
            ],

            // ── Component type demand ────────────────────────────────────
            componentDemand: [
              {
                $group: {
                  _id: "$componentType",
                  totalRequests: { $sum: 1 },
                  totalUnitsRequested: { $sum: "$unitsRequested" },
                },
              },
              { $sort: { totalUnitsRequested: -1 } },
            ],
          },
        },
      ];

      const [result] = await BloodRequest.aggregate(pipeline).exec();
      return result;
    } catch (error) {
      throw error;
    }
  }
}

export default new BloodRequestRepository();
