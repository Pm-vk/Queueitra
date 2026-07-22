import mongoose from "mongoose";
import bloodRequestRepository from "../repositories/bloodRequest.repository.js";
import allocationEngine from "./allocation.service.js";
import Office from "../../../models/Office.js";
import ApiError from "../../../utils/ApiError.js";
import { generateRequestNumber } from "../utils/bloodRequest.utils.js";
import {
  REQUEST_STATUS,
  TERMINAL_REQUEST_STATUSES,
  ALLOWED_REQUEST_TRANSITIONS,
  ALLOCATABLE_STATUSES,
  STAFF_CANCELLABLE_STATUSES,
} from "../constants/bloodRequest.constants.js";

class BloodRequestService {
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
      throw new ApiError(403, "Forbidden: You do not have permission to perform this action");
    }
  }

  /**
   * Validate a status transition against the state machine.
   * @param {string} current
   * @param {string} next
   */
  _validateStatusTransition(current, next) {
    if (current === next) {
      throw new ApiError(400, `Request is already in "${current}" status`);
    }
    const allowed = ALLOWED_REQUEST_TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw new ApiError(
        400,
        `Cannot transition from "${current}" to "${next}". ` +
          `Allowed: ${allowed?.join(", ") || "none (terminal)"}`
      );
    }
  }

  /**
   * Verify office exists and is active.
   * @param {string} officeId
   * @returns {Promise<Object>}
   */
  async _verifyOfficeExists(officeId) {
    const office = await Office.findById(officeId).lean().exec();
    if (!office) throw new ApiError(404, `Office with ID "${officeId}" not found`);
    if (!office.isActive) throw new ApiError(400, "Selected office is inactive");
    return office;
  }

  /**
   * Resolve an existing request and check it's not terminal.
   * @param {string} id
   * @param {string[]} allowedStatuses - Optional: restrict to specific statuses
   * @returns {Promise<Object>}
   */
  async _getActiveRequest(id, allowedStatuses = null) {
    const request = await bloodRequestRepository.findById(id);
    if (!request) throw new ApiError(404, "Blood request not found");

    if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
      throw new ApiError(400, `Cannot modify a ${request.status} request`);
    }

    if (allowedStatuses && !allowedStatuses.includes(request.status)) {
      throw new ApiError(
        400,
        `This action requires the request to be in one of: ${allowedStatuses.join(", ")}. ` +
          `Current: ${request.status}`
      );
    }

    return request;
  }

  // ─── Public Service Methods ───────────────────────────────────────────────

  /**
   * Create a new blood request.
   * STAFF, ADMIN, SUPER_ADMIN only (CUSTOMER has no access).
   *
   * @param {Object} data - Validated request body
   * @param {Object} user - req.user
   * @returns {Promise<Object>} Created blood request
   */
  async createRequest(data, user) {
    this._verifyStaffOrAbove(user);

    const {
      hospitalName,
      hospitalContact,
      patientName,
      patientAge,
      patientGender,
      doctorName,
      bloodGroup,
      componentType,
      unitsRequested,
      priority,
      reason,
      requiredBefore,
      officeId,
      remarks,
    } = data;

    // Validate requiredBefore is not in the past
    const requiredDate = new Date(requiredBefore);
    if (requiredDate < new Date()) {
      throw new ApiError(400, '"requiredBefore" date cannot be in the past');
    }

    await this._verifyOfficeExists(officeId);

    const requestNumber = generateRequestNumber();

    return await bloodRequestRepository.createRequest({
      requestNumber,
      hospitalName: hospitalName.trim(),
      hospitalContact: hospitalContact.trim(),
      patientName: patientName.trim(),
      patientAge,
      patientGender,
      doctorName: doctorName.trim(),
      bloodGroup,
      componentType,
      unitsRequested,
      priority: priority ?? "NORMAL",
      reason: reason.trim(),
      requiredBefore: requiredDate,
      officeId,
      status: REQUEST_STATUS.PENDING,
      allocatedUnits: [],
      remarks: remarks ?? null,
      requestedBy: user._id,
      createdBy: user._id,
      isActive: true,
    });
  }

  /**
   * Get a single blood request by ID.
   * STAFF: can view own requests + office requests.
   * ADMIN/SUPER_ADMIN: any request.
   *
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getRequestById(id, user) {
    this._verifyStaffOrAbove(user);
    const request = await bloodRequestRepository.findById(id);
    if (!request) throw new ApiError(404, "Blood request not found");
    return request;
  }

  /**
   * Get all blood requests with pagination, filtering, search, and sorting.
   * STAFF: results scoped to their own created requests.
   * ADMIN/SUPER_ADMIN: all requests.
   *
   * @param {Object} options
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async getAllRequests(options = {}, user) {
    this._verifyStaffOrAbove(user);
    const queryOptions = { ...options };

    // STAFF only sees their own requests
    if (user.role === "STAFF") {
      queryOptions.createdBy = user._id.toString();
    }

    return await bloodRequestRepository.findAllRequests(queryOptions);
  }

  /**
   * Update blood request fields.
   * STAFF: can update only their own PENDING requests.
   * ADMIN/SUPER_ADMIN: can update any non-terminal request.
   *
   * @param {string} id
   * @param {Object} data
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async updateRequest(id, data, user) {
    this._verifyStaffOrAbove(user);

    const existing = await bloodRequestRepository.findById(id);
    if (!existing) throw new ApiError(404, "Blood request not found");

    if (TERMINAL_REQUEST_STATUSES.includes(existing.status)) {
      throw new ApiError(400, `Cannot update a ${existing.status} request`);
    }

    // STAFF: can only edit own PENDING requests
    if (user.role === "STAFF") {
      const ownerId = existing.createdBy?._id?.toString() ?? existing.createdBy?.toString();
      if (ownerId !== user._id.toString()) {
        throw new ApiError(403, "Forbidden: You can only update your own requests");
      }
      if (existing.status !== REQUEST_STATUS.PENDING) {
        throw new ApiError(
          400,
          `STAFF can only update PENDING requests. Current status: ${existing.status}`
        );
      }
    }

    if (!data || Object.keys(data).length === 0) {
      throw new ApiError(400, "No update fields provided");
    }

    if (data.requiredBefore) {
      const requiredDate = new Date(data.requiredBefore);
      if (requiredDate < new Date()) {
        throw new ApiError(400, '"requiredBefore" date cannot be in the past');
      }
      data.requiredBefore = requiredDate;
    }

    const updated = await bloodRequestRepository.updateRequest(id, data);
    if (!updated) throw new ApiError(404, "Blood request not found");
    return updated;
  }

  /**
   * Approve a blood request.
   * Sets status to APPROVED and records the approver.
   * ADMIN and SUPER_ADMIN only.
   *
   * @param {string} id
   * @param {Object} user
   * @param {string|null} remarks
   * @returns {Promise<Object>}
   */
  async approveRequest(id, user, remarks = null) {
    this._verifyAdminPrivileges(user);

    const request = await bloodRequestRepository.findById(id);
    if (!request) throw new ApiError(404, "Blood request not found");

    this._validateStatusTransition(request.status, REQUEST_STATUS.APPROVED);

    const updated = await bloodRequestRepository.updateRequest(id, {
      status: REQUEST_STATUS.APPROVED,
      approvedBy: user._id,
      ...(remarks !== null ? { remarks } : {}),
    });
    if (!updated) throw new ApiError(404, "Blood request not found");
    return updated;
  }

  /**
   * Reject a blood request.
   * ADMIN and SUPER_ADMIN only. Remarks are required.
   *
   * @param {string} id
   * @param {Object} user
   * @param {string} remarks - Required rejection reason
   * @returns {Promise<Object>}
   */
  async rejectRequest(id, user, remarks) {
    this._verifyAdminPrivileges(user);

    const request = await bloodRequestRepository.findById(id);
    if (!request) throw new ApiError(404, "Blood request not found");

    this._validateStatusTransition(request.status, REQUEST_STATUS.REJECTED);

    const updated = await bloodRequestRepository.updateRequest(id, {
      status: REQUEST_STATUS.REJECTED,
      isActive: false,
      remarks,
    });
    if (!updated) throw new ApiError(404, "Blood request not found");
    return updated;
  }

  /**
   * Cancel a blood request.
   * - STAFF: can cancel own requests in PENDING or UNDER_REVIEW only
   * - ADMIN/SUPER_ADMIN: can cancel any non-terminal, non-fulfilled request
   *
   * When cancelling a PARTIALLY_FULFILLED request, releases RESERVED inventory
   * units back to AVAILABLE inside a transaction.
   *
   * @param {string} id
   * @param {Object} user
   * @param {string|null} remarks
   * @returns {Promise<Object>}
   */
  async cancelRequest(id, user, remarks = null) {
    this._verifyStaffOrAbove(user);

    const request = await bloodRequestRepository.findById(id);
    if (!request) throw new ApiError(404, "Blood request not found");

    if (TERMINAL_REQUEST_STATUSES.includes(request.status)) {
      throw new ApiError(400, `Cannot cancel a ${request.status} request`);
    }

    // STAFF: restricted to own requests + limited statuses
    if (user.role === "STAFF") {
      const ownerId = request.createdBy?._id?.toString() ?? request.createdBy?.toString();
      if (ownerId !== user._id.toString()) {
        throw new ApiError(403, "Forbidden: You can only cancel your own requests");
      }
      if (!STAFF_CANCELLABLE_STATUSES.includes(request.status)) {
        throw new ApiError(
          400,
          `STAFF can only cancel requests in: ${STAFF_CANCELLABLE_STATUSES.join(", ")}. ` +
            `Current: ${request.status}`
        );
      }
    }

    // For PARTIALLY_FULFILLED: release reserved inventory units in a transaction
    const hasReservedUnits =
      request.status === REQUEST_STATUS.PARTIALLY_FULFILLED &&
      request.allocatedUnits?.length > 0;

    if (hasReservedUnits) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await allocationEngine.releaseReservedUnits(request.allocatedUnits, session);

        const updated = await bloodRequestRepository.updateRequest(
          id,
          { status: REQUEST_STATUS.CANCELLED, isActive: false, remarks },
          session
        );

        await session.commitTransaction();
        return updated;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

    // Simple cancellation (no inventory to release)
    const updated = await bloodRequestRepository.updateRequest(id, {
      status: REQUEST_STATUS.CANCELLED,
      isActive: false,
      ...(remarks !== null ? { remarks } : {}),
    });
    if (!updated) throw new ApiError(404, "Blood request not found");
    return updated;
  }

  /**
   * Allocate blood units to an approved or partially fulfilled request.
   *
   * WORKFLOW (all steps atomic inside a MongoDB transaction):
   *   1. Find AVAILABLE InventoryUnits matching bloodGroup + componentType + officeId
   *   2. Run allocation engine → selectUnits()
   *   3. If no units available → ApiError 409
   *   4. Apply allocation:
   *      - willFulfill → mark units ISSUED, request FULFILLED, fulfilledAt = now
   *      - partial      → mark units RESERVED, request PARTIALLY_FULFILLED
   *   5. Append unit IDs to request.allocatedUnits
   *   6. Commit transaction
   *
   * ADMIN and SUPER_ADMIN only.
   *
   * @param {string} id - BloodRequest ObjectId
   * @param {Object} user
   * @returns {Promise<Object>} Updated blood request with allocatedUnits populated
   */
  async allocateBlood(id, user) {
    this._verifyAdminPrivileges(user);

    const request = await bloodRequestRepository.findById(id);
    if (!request) throw new ApiError(404, "Blood request not found");

    if (!ALLOCATABLE_STATUSES.includes(request.status)) {
      throw new ApiError(
        400,
        `Allocation requires status in: ${ALLOCATABLE_STATUSES.join(", ")}. ` +
          `Current: ${request.status}`
      );
    }

    // ── Step 1: Discover candidates ────────────────────────────────────────
    const availableUnits = await allocationEngine.findCandidates(request);

    if (availableUnits.length === 0) {
      throw new ApiError(
        409,
        `No available ${request.bloodGroup} ${request.componentType} units found at the selected office`
      );
    }

    // ── Step 2: Run allocation engine (pure decision, no DB writes) ────────
    const { selectedUnits, willFulfill } = await allocationEngine.run(
      request,
      availableUnits
    );

    if (selectedUnits.length === 0) {
      throw new ApiError(
        409,
        "Allocation engine could not select any units for this request"
      );
    }

    const selectedUnitIds = selectedUnits.map((u) => u._id);
    const now = new Date();

    // ── Steps 3–5: Apply allocation atomically ─────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Apply status to InventoryUnits (ISSUED if fulfilled, RESERVED if partial)
      await allocationEngine.applyAllocation(
        selectedUnitIds,
        request.requestNumber,
        willFulfill,
        session
      );

      // Determine new request status
      const newRequestStatus = willFulfill
        ? REQUEST_STATUS.FULFILLED
        : REQUEST_STATUS.PARTIALLY_FULFILLED;

      const requestUpdate = { status: newRequestStatus };
      if (willFulfill) requestUpdate.fulfilledAt = now;

      // Append allocated unit IDs and update status
      const updatedRequest = await bloodRequestRepository.appendAllocatedUnits(
        id,
        selectedUnitIds,
        requestUpdate,
        session
      );

      await session.commitTransaction();

      return {
        request: updatedRequest,
        allocation: {
          unitsAllocated: selectedUnits.length,
          isFulfilled: willFulfill,
          remainingShortfall: request.unitsRequested - (request.allocatedUnits.length + selectedUnits.length),
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get blood request dashboard statistics.
   * ADMIN and SUPER_ADMIN only.
   * Optionally scoped to a specific office.
   *
   * @param {Object} options - { officeId? }
   * @param {Object} user
   * @returns {Promise<Object>} Formatted dashboard data
   */
  async getDashboard(options = {}, user) {
    this._verifyAdminPrivileges(user);

    const raw = await bloodRequestRepository.getDashboardAggregation(
      options.officeId || null
    );

    // ── Format aggregation result ──────────────────────────────────────────
    const totalCount = raw.total?.[0]?.count ?? 0;

    // Status breakdown
    const statusMap = {};
    for (const s of raw.statusSummary ?? []) {
      statusMap[s._id] = s.count;
    }

    // Average fulfillment time in minutes
    const avgFulfillmentMs = raw.avgFulfillmentTime?.[0]?.avgDurationMs ?? null;
    const avgFulfillmentMinutes = avgFulfillmentMs
      ? Math.round(avgFulfillmentMs / (1000 * 60))
      : null;

    return {
      overview: {
        total: totalCount,
        pending: statusMap["PENDING"] ?? 0,
        underReview: statusMap["UNDER_REVIEW"] ?? 0,
        approved: statusMap["APPROVED"] ?? 0,
        partiallyFulfilled: statusMap["PARTIALLY_FULFILLED"] ?? 0,
        fulfilled: statusMap["FULFILLED"] ?? 0,
        rejected: statusMap["REJECTED"] ?? 0,
        cancelled: statusMap["CANCELLED"] ?? 0,
      },
      emergencyRequests: raw.emergencyRequests ?? [],
      avgFulfillmentTimeMinutes: avgFulfillmentMinutes,
      totalFulfilledRequests: raw.avgFulfillmentTime?.[0]?.totalFulfilled ?? 0,
      officeWise: raw.officeWise ?? [],
      bloodGroupDemand: raw.bloodGroupDemand ?? [],
      componentDemand: raw.componentDemand ?? [],
    };
  }

  /**
   * Soft delete a blood request.
   * ADMIN and SUPER_ADMIN only.
   * Cannot delete FULFILLED or PARTIALLY_FULFILLED requests (they are permanent records).
   *
   * @param {string} id
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async deleteRequest(id, user) {
    this._verifyAdminPrivileges(user);

    const request = await bloodRequestRepository.findById(id);
    if (!request) throw new ApiError(404, "Blood request not found");

    const unDeletableStatuses = [
      REQUEST_STATUS.FULFILLED,
      REQUEST_STATUS.PARTIALLY_FULFILLED,
    ];

    if (unDeletableStatuses.includes(request.status)) {
      throw new ApiError(
        400,
        `${request.status} requests cannot be deleted — they are permanent records`
      );
    }

    return await bloodRequestRepository.softDeleteRequest(id);
  }
}

export default new BloodRequestService();
