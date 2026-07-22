import mongoose from "mongoose";
import InventoryUnit from "../models/inventory.model.js";
import Donor from "../../donor/models/donor.model.js";
import {
  INVENTORY_STATUS,
  ALLOWED_INVENTORY_SORT_FIELDS,
  NEAR_EXPIRY_DAYS,
} from "../constants/inventory.constants.js";

/**
 * Shared populate config for all read queries.
 * transferHistory.fromOfficeId and toOfficeId are populated only on demand
 * (they are nested sub-documents and would bloat list responses).
 */
const POPULATE_CONFIG = [
  { path: "donorId", select: "name email phone bloodGroup" },
  { path: "officeId", select: "name city officeType" },
  { path: "donationId", select: "donationType volume collectionTime completedAt" },
  { path: "createdBy", select: "name email" },
  { path: "reservedFor", select: "name email" },
];

class InventoryRepository {
  // ─── Create ──────────────────────────────────────────────────────────────

  /**
   * Insert a new InventoryUnit document.
   * Accepts an optional Mongoose session for transactional use
   * (called from the donation completion workflow).
   *
   * @param {Object} data
   * @param {Object|null} session
   * @returns {Promise<Object>} Created unit (populated)
   */
  async createInventoryUnit(data, session = null) {
    try {
      const options = session ? { session } : {};
      const [unit] = await InventoryUnit.create([data], options);
      return await unit.populate(POPULATE_CONFIG);
    } catch (error) {
      throw error;
    }
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  /**
   * Find a single unit by MongoDB ObjectId.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    try {
      return await InventoryUnit.findById(id)
        .populate(POPULATE_CONFIG)
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a unit by the human-readable bloodUnitId string.
   * @param {string} bloodUnitId
   * @returns {Promise<Object|null>}
   */
  async findByBloodUnitId(bloodUnitId) {
    try {
      return await InventoryUnit.findOne({
        bloodUnitId: bloodUnitId.toUpperCase(),
      })
        .populate(POPULATE_CONFIG)
        .lean()
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Paginated inventory query supporting search, filtering, and sorting.
   *
   * @param {Object} options
   * @returns {Promise<Object>} { units, total, page, totalPages }
   */
  async findAllUnits(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        bloodUnitId,
        bloodGroup,
        componentType,
        status,
        officeId,
        donorIds,         // Pre-resolved from donor name search
        collectionDateFrom,
        collectionDateTo,
        expiryDateFrom,
        expiryDateTo,
        isActive,
        sortBy = "expiryDate",
        sortOrder = "asc",  // Default asc: soonest expiring first
      } = options;

      const filter = {};

      if (isActive !== undefined) filter.isActive = isActive;
      if (bloodGroup) filter.bloodGroup = bloodGroup;
      if (componentType) filter.componentType = componentType;
      if (status) filter.status = status;
      if (officeId) filter.officeId = officeId;

      if (bloodUnitId) {
        filter.bloodUnitId = { $regex: bloodUnitId, $options: "i" };
      }

      if (donorIds && donorIds.length > 0) {
        filter.donorId = { $in: donorIds };
      } else if (donorIds && donorIds.length === 0) {
        return { units: [], total: 0, page: Number(page), totalPages: 0 };
      }

      if (collectionDateFrom || collectionDateTo) {
        filter.collectionDate = {};
        if (collectionDateFrom) filter.collectionDate.$gte = new Date(collectionDateFrom);
        if (collectionDateTo) filter.collectionDate.$lte = new Date(collectionDateTo);
      }

      if (expiryDateFrom || expiryDateTo) {
        filter.expiryDate = {};
        if (expiryDateFrom) filter.expiryDate.$gte = new Date(expiryDateFrom);
        if (expiryDateTo) filter.expiryDate.$lte = new Date(expiryDateTo);
      }

      const resolvedSortBy = ALLOWED_INVENTORY_SORT_FIELDS.includes(sortBy)
        ? sortBy
        : "expiryDate";
      const sort = { [resolvedSortBy]: sortOrder === "desc" ? -1 : 1 };
      const skip = (Number(page) - 1) * Number(limit);

      const [units, total] = await Promise.all([
        InventoryUnit.find(filter)
          .populate(POPULATE_CONFIG)
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean()
          .exec(),
        InventoryUnit.countDocuments(filter).exec(),
      ]);

      return {
        units,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resolve donor IDs from a donor name search term.
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

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Update an InventoryUnit by ID.
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object|null>} Updated unit (populated)
   */
  async updateUnit(id, updateData) {
    try {
      return await InventoryUnit.findByIdAndUpdate(
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
   * Append a transfer event to the unit's transferHistory array.
   * Used during the transfer workflow alongside a status update.
   *
   * @param {string} id
   * @param {Object} transferEvent
   * @param {Object} statusUpdate - Additional fields to $set (e.g., officeId, status)
   * @returns {Promise<Object|null>}
   */
  async appendTransferHistory(id, transferEvent, statusUpdate = {}) {
    try {
      return await InventoryUnit.findByIdAndUpdate(
        id,
        {
          $set: { status: INVENTORY_STATUS.TRANSFERRED, ...statusUpdate },
          $push: { transferHistory: transferEvent },
        },
        { returnDocument: "after", runValidators: true }
      )
        .populate(POPULATE_CONFIG)
        .exec();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Soft delete a unit.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async softDeleteUnit(id) {
    try {
      return await InventoryUnit.findByIdAndUpdate(
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
   * Run a comprehensive aggregation pipeline for the inventory dashboard.
   *
   * Uses $facet to compute multiple aggregations in a single pass.
   * Only considers isActive:true records for accuracy.
   *
   * @param {string|null} officeId - Optional office filter for office-level dashboards
   * @returns {Promise<Object>} Raw aggregation result
   */
  async getDashboardAggregation(officeId = null) {
    try {
      const matchStage = { isActive: true };
      if (officeId) {
        matchStage.officeId = new mongoose.Types.ObjectId(officeId);
      }

      const now = new Date();
      const nearExpiryThreshold = new Date();
      nearExpiryThreshold.setDate(nearExpiryThreshold.getDate() + NEAR_EXPIRY_DAYS);

      const pipeline = [
        { $match: matchStage },
        {
          $facet: {
            // ── Total count ──────────────────────────────────────────────
            total: [{ $count: "count" }],

            // ── Per-status counts and total volumes ──────────────────────
            statusSummary: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                  totalVolume: { $sum: "$volume" },
                },
              },
              { $sort: { _id: 1 } },
            ],

            // ── Blood group distribution (AVAILABLE only) ─────────────────
            bloodGroupDistribution: [
              { $match: { status: INVENTORY_STATUS.AVAILABLE } },
              {
                $group: {
                  _id: "$bloodGroup",
                  count: { $sum: 1 },
                  totalVolume: { $sum: "$volume" },
                },
              },
              { $sort: { _id: 1 } },
            ],

            // ── Component type distribution ──────────────────────────────
            componentDistribution: [
              { $match: { status: INVENTORY_STATUS.AVAILABLE } },
              {
                $group: {
                  _id: "$componentType",
                  count: { $sum: 1 },
                  totalVolume: { $sum: "$volume" },
                },
              },
              { $sort: { _id: 1 } },
            ],

            // ── Near-expiry AVAILABLE units ──────────────────────────────
            nearExpiry: [
              {
                $match: {
                  status: INVENTORY_STATUS.AVAILABLE,
                  expiryDate: { $gte: now, $lte: nearExpiryThreshold },
                },
              },
              { $sort: { expiryDate: 1 } },
              { $limit: 100 },
              {
                $project: {
                  bloodUnitId: 1,
                  bloodGroup: 1,
                  componentType: 1,
                  volume: 1,
                  expiryDate: 1,
                  officeId: 1,
                },
              },
            ],

            // ── Office-wise AVAILABLE inventory ──────────────────────────
            officeWise: [
              { $match: { status: INVENTORY_STATUS.AVAILABLE } },
              {
                $group: {
                  _id: "$officeId",
                  availableUnits: { $sum: 1 },
                  totalVolume: { $sum: "$volume" },
                },
              },
            ],
          },
        },
      ];

      const [result] = await InventoryUnit.aggregate(pipeline).exec();
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark all expired AVAILABLE/RESERVED units as EXPIRED in bulk.
   * Intended to be called by a scheduled job (cron/BullMQ worker).
   * @returns {Promise<number>} Number of units updated
   */
  async bulkMarkExpired() {
    try {
      const result = await InventoryUnit.updateMany(
        {
          expiryDate: { $lt: new Date() },
          status: { $in: [INVENTORY_STATUS.AVAILABLE, INVENTORY_STATUS.RESERVED] },
          isActive: true,
        },
        {
          $set: { status: INVENTORY_STATUS.EXPIRED },
        }
      ).exec();
      return result.modifiedCount;
    } catch (error) {
      throw error;
    }
  }
}

export default new InventoryRepository();
