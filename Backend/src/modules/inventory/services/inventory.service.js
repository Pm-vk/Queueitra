import inventoryRepository from "../repositories/inventory.repository.js";
import Office from "../../../models/Office.js";
import ApiError from "../../../utils/ApiError.js";
import {
  INVENTORY_STATUS,
  TERMINAL_INVENTORY_STATUSES,
  ALLOWED_INVENTORY_TRANSITIONS,
  DONATION_TYPE_TO_COMPONENT,
} from "../constants/inventory.constants.js";
import {
  generateBloodUnitId,
  calculateExpiryDate,
  isExpired,
} from "../utils/inventory.utils.js";

class InventoryService {
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

  _validateStatusTransition(current, next) {
    if (current === next) {
      throw new ApiError(400, `Unit is already in "${current}" status`);
    }

    const allowed = ALLOWED_INVENTORY_TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw new ApiError(
        400,
        `Cannot transition from "${current}" to "${next}". Allowed: ${
          allowed?.join(", ") || "none (terminal status)"
        }`
      );
    }
  }

  async _verifyOfficeExists(officeId) {
    const office = await Office.findById(officeId).lean().exec();
    if (!office) throw new ApiError(404, `Office with ID "${officeId}" not found`);
    if (!office.isActive) throw new ApiError(400, "Office is inactive");
    return office;
  }

  // ─── Public Service Methods ───────────────────────────────────────────────

  /**
   * Manually create an inventory unit (ADMIN / SUPER_ADMIN).
   */
  async createInventoryUnit(data, user) {
    this._verifyAdminPrivileges(user);

    const {
      donorId,
      donationId,
      officeId,
      bloodGroup,
      componentType,
      collectionDate,
      expiryDate,
      volume,
      storageLocation,
      temperature,
      remarks,
    } = data;

    await this._verifyOfficeExists(officeId);

    const colDate = new Date(collectionDate);
    const expDate = expiryDate
      ? new Date(expiryDate)
      : calculateExpiryDate(componentType, colDate);

    const bloodUnitId = generateBloodUnitId();

    return await inventoryRepository.createInventoryUnit({
      bloodUnitId,
      donorId,
      donationId: donationId || null,
      officeId,
      bloodGroup,
      componentType,
      collectionDate: colDate,
      expiryDate: expDate,
      volume,
      storageLocation: storageLocation ?? null,
      temperature: temperature ?? null,
      remarks: remarks ?? null,
      status: INVENTORY_STATUS.AVAILABLE,
      createdBy: user._id,
      isActive: true,
    });
  }

  /**
   * Get a single unit by ObjectId or human-readable bloodUnitId string.
   */
  async getUnitById(idOrUnitId, user) {
    this._verifyStaffOrAbove(user);

    let unit = null;
    if (idOrUnitId.startsWith("BU-")) {
      unit = await inventoryRepository.findByBloodUnitId(idOrUnitId);
    } else {
      unit = await inventoryRepository.findById(idOrUnitId);
    }

    if (!unit) throw new ApiError(404, "Blood inventory unit not found");
    return unit;
  }

  /**
   * Get all units with pagination, filter, search, and sorting.
   */
  async getAllUnits(options = {}, user) {
    this._verifyStaffOrAbove(user);
    const queryOptions = { ...options };

    if (options.search) {
      if (options.search.toUpperCase().startsWith("BU-")) {
        queryOptions.bloodUnitId = options.search;
      } else {
        const donorIds = await inventoryRepository.resolveDonorIdsBySearch(
          options.search
        );
        queryOptions.donorIds = donorIds;
      }
      delete queryOptions.search;
    }

    return await inventoryRepository.findAllUnits(queryOptions);
  }

  /**
   * Update non-status fields (storage location, temperature, remarks, volume).
   */
  async updateUnit(id, data, user) {
    this._verifyAdminPrivileges(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    if (TERMINAL_INVENTORY_STATUSES.includes(existing.status)) {
      throw new ApiError(400, `Cannot update a ${existing.status} unit`);
    }

    if (!data || Object.keys(data).length === 0) {
      throw new ApiError(400, "No update fields provided");
    }

    const updated = await inventoryRepository.updateUnit(id, data);
    if (!updated) throw new ApiError(404, "Blood inventory unit not found");
    return updated;
  }

  /**
   * Generic status update with state machine validation.
   */
  async updateStatus(id, newStatus, user, remarks = null) {
    this._verifyAdminPrivileges(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    this._validateStatusTransition(existing.status, newStatus);

    if (
      (newStatus === INVENTORY_STATUS.RESERVED || newStatus === INVENTORY_STATUS.ISSUED) &&
      isExpired(existing.expiryDate)
    ) {
      throw new ApiError(
        400,
        `Cannot set status to ${newStatus} because the unit has expired`
      );
    }

    const updateData = { status: newStatus };
    if (remarks !== undefined && remarks !== null) updateData.remarks = remarks;

    const updated = await inventoryRepository.updateUnit(id, updateData);
    if (!updated) throw new ApiError(404, "Blood inventory unit not found");
    return updated;
  }

  /**
   * Reserve a blood unit for a specific user.
   */
  async reserveUnit(id, reservedForUserId, user, remarks = null) {
    this._verifyStaffOrAbove(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    if (existing.status !== INVENTORY_STATUS.AVAILABLE) {
      throw new ApiError(
        400,
        `Cannot reserve unit in status "${existing.status}". Only AVAILABLE units can be reserved.`
      );
    }

    if (isExpired(existing.expiryDate)) {
      throw new ApiError(400, "Cannot reserve an expired blood unit");
    }

    const updateData = {
      status: INVENTORY_STATUS.RESERVED,
      reservedFor: reservedForUserId,
    };
    if (remarks) updateData.remarks = remarks;

    const updated = await inventoryRepository.updateUnit(id, updateData);
    if (!updated) throw new ApiError(404, "Blood inventory unit not found");
    return updated;
  }

  /**
   * Release a reservation back to AVAILABLE.
   */
  async releaseReservation(id, user, remarks = null) {
    this._verifyStaffOrAbove(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    if (existing.status !== INVENTORY_STATUS.RESERVED) {
      throw new ApiError(400, "Unit is not currently reserved");
    }

    const updateData = {
      status: INVENTORY_STATUS.AVAILABLE,
      reservedFor: null,
    };
    if (remarks) updateData.remarks = remarks;

    const updated = await inventoryRepository.updateUnit(id, updateData);
    if (!updated) throw new ApiError(404, "Blood inventory unit not found");
    return updated;
  }

  /**
   * Mark a unit as ISSUED.
   */
  async markIssued(id, issuedTo, user, remarks = null) {
    this._verifyStaffOrAbove(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    if (
      existing.status !== INVENTORY_STATUS.AVAILABLE &&
      existing.status !== INVENTORY_STATUS.RESERVED
    ) {
      throw new ApiError(
        400,
        `Cannot issue unit in status "${existing.status}". Must be AVAILABLE or RESERVED.`
      );
    }

    if (isExpired(existing.expiryDate)) {
      throw new ApiError(400, "Cannot issue an expired blood unit");
    }

    const updateData = {
      status: INVENTORY_STATUS.ISSUED,
      issuedTo: issuedTo.trim(),
      reservedFor: null,
    };
    if (remarks) updateData.remarks = remarks;

    const updated = await inventoryRepository.updateUnit(id, updateData);
    if (!updated) throw new ApiError(404, "Blood inventory unit not found");
    return updated;
  }

  /**
   * Mark a unit as EXPIRED.
   */
  async markExpired(id, user, remarks = null) {
    this._verifyAdminPrivileges(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    this._validateStatusTransition(existing.status, INVENTORY_STATUS.EXPIRED);

    const updateData = {
      status: INVENTORY_STATUS.EXPIRED,
      reservedFor: null,
    };
    if (remarks) updateData.remarks = remarks;

    const updated = await inventoryRepository.updateUnit(id, updateData);
    if (!updated) throw new ApiError(404, "Blood inventory unit not found");
    return updated;
  }

  /**
   * Mark a unit as DISCARDED.
   */
  async markDiscarded(id, reason, user) {
    this._verifyAdminPrivileges(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    this._validateStatusTransition(existing.status, INVENTORY_STATUS.DISCARDED);

    const updated = await inventoryRepository.updateUnit(id, {
      status: INVENTORY_STATUS.DISCARDED,
      reservedFor: null,
      remarks: reason,
      isActive: false,
    });
    if (!updated) throw new ApiError(404, "Blood inventory unit not found");
    return updated;
  }

  /**
   * Transfer a unit to another office.
   */
  async transferUnit(id, toOfficeId, user, remarks = null) {
    this._verifyAdminPrivileges(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    if (existing.status !== INVENTORY_STATUS.AVAILABLE) {
      throw new ApiError(
        400,
        `Cannot transfer unit in status "${existing.status}". Must be AVAILABLE.`
      );
    }

    const currentOfficeId = existing.officeId?._id?.toString() ?? existing.officeId?.toString();
    if (currentOfficeId === toOfficeId) {
      throw new ApiError(400, "Unit is already at this office");
    }

    await this._verifyOfficeExists(toOfficeId);

    const transferEvent = {
      fromOfficeId: currentOfficeId,
      toOfficeId,
      transferredAt: new Date(),
      transferredBy: user._id,
      remarks: remarks ?? undefined,
    };

    const updated = await inventoryRepository.appendTransferHistory(
      id,
      transferEvent,
      {
        officeId: toOfficeId,
        status: INVENTORY_STATUS.AVAILABLE,
      }
    );

    if (!updated) throw new ApiError(404, "Blood inventory unit not found");
    return updated;
  }

  /**
   * Inventory Dashboard API.
   */
  async getDashboard(options = {}, user) {
    this._verifyStaffOrAbove(user);

    const raw = await inventoryRepository.getDashboardAggregation(
      options.officeId || null
    );

    const totalCount = raw.total?.[0]?.count ?? 0;

    const statusMap = {};
    let totalVolume = 0;
    for (const s of raw.statusSummary ?? []) {
      statusMap[s._id] = s.count;
      totalVolume += s.totalVolume;
    }

    return {
      overview: {
        totalUnits: totalCount,
        totalVolumeMl: totalVolume,
        availableUnits: statusMap["AVAILABLE"] ?? 0,
        reservedUnits: statusMap["RESERVED"] ?? 0,
        issuedUnits: statusMap["ISSUED"] ?? 0,
        transferredUnits: statusMap["TRANSFERRED"] ?? 0,
        expiredUnits: statusMap["EXPIRED"] ?? 0,
        discardedUnits: statusMap["DISCARDED"] ?? 0,
      },
      bloodGroupDistribution: raw.bloodGroupDistribution ?? [],
      componentDistribution: raw.componentDistribution ?? [],
      nearExpiryUnits: raw.nearExpiry ?? [],
      officeWise: raw.officeWise ?? [],
    };
  }

  /**
   * Soft delete unit.
   */
  async deleteUnit(id, user) {
    this._verifyAdminPrivileges(user);

    const existing = await inventoryRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood inventory unit not found");

    if (existing.status === INVENTORY_STATUS.ISSUED) {
      throw new ApiError(400, "Issued units cannot be deleted");
    }

    if (!existing.isActive) {
      throw new ApiError(400, "Unit is already inactive");
    }

    return await inventoryRepository.softDeleteUnit(id);
  }
}

export default new InventoryService();
