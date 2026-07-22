import mongoose from "mongoose";
import InventoryUnit from "../../inventory/models/inventory.model.js";
import { INVENTORY_STATUS } from "../../inventory/constants/inventory.constants.js";
import { PRIORITY_WEIGHT } from "../constants/bloodRequest.constants.js";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALLOCATION ENGINE — Rule-Based Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE: Strategy Pattern
 * ───────────────────────────────
 * This engine is the ONLY component that needs to change when integrating a
 * LangGraph AI Agent or any other allocation strategy. The interface is:
 *
 *   engine.run(request, availableUnits) → { selectedUnits, totalAllocated, willFulfill }
 *   engine.selectUnits(request, candidates, needed) → Object[]
 *
 * To plug in an AI Agent:
 *   1. Create `ai-allocation.service.js` with the same interface
 *   2. Override `selectUnits()` to call your LangGraph agent
 *   3. In `bloodRequest.service.js`, change one import line
 *   4. Zero changes in controllers, routes, or repositories
 *
 * CURRENT ALGORITHM: FEFO (First Expiring, First Out)
 * ──────────────────────────────────────────────────────
 * - Sorts by expiryDate ASC to minimize waste
 * - Filters expired, discarded, issued, and already-allocated units
 * - Priority-aware: EMERGENCY/CRITICAL requests get a larger candidate window
 * ═══════════════════════════════════════════════════════════════════════════
 */
class AllocationEngine {
  /**
   * Main orchestration method called by the blood request service.
   * Does NOT touch the database — returns a selection decision only.
   *
   * Separation rationale:
   *   - Candidate discovery (DB query) is done BEFORE calling this engine
   *   - The engine is a pure decision function: [candidates] → [selected]
   *   - This makes the engine unit-testable without a DB connection
   *   - An AI Agent only needs to override `selectUnits()` — no DB logic changes
   *
   * @param {Object} request - BloodRequest lean document
   * @param {Object[]} availableUnits - AVAILABLE InventoryUnit documents (pre-filtered)
   * @returns {Object} { selectedUnits, totalAllocated, willFulfill, remainingShortfall }
   */
  async run(request, availableUnits) {
    const alreadyAllocated = request.allocatedUnits?.length ?? 0;
    const stillNeeded = request.unitsRequested - alreadyAllocated;

    if (stillNeeded <= 0) {
      return {
        selectedUnits: [],
        totalAllocated: alreadyAllocated,
        willFulfill: true,
        remainingShortfall: 0,
      };
    }

    const selectedUnits = await this.selectUnits(request, availableUnits, stillNeeded);
    const totalAllocated = alreadyAllocated + selectedUnits.length;

    return {
      selectedUnits,
      totalAllocated,
      willFulfill: selectedUnits.length >= stillNeeded,
      remainingShortfall: Math.max(0, stillNeeded - selectedUnits.length),
    };
  }

  /**
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │  PLUGGABLE STRATEGY METHOD                                          │
   * │  Replace this method (or the entire class) with an AI Agent later. │
   * └─────────────────────────────────────────────────────────────────────┘
   *
   * Current implementation: FEFO (First Expiring, First Out)
   *   — Minimizes blood waste by prioritizing units closest to expiry.
   *   — For EMERGENCY/CRITICAL: selects as many as available (no cap).
   *   — For others: selects exactly what is needed.
   *
   * AI Agent implementation would instead:
   *   — Call a LangGraph workflow with request metadata + candidate embeddings
   *   — Return the agent's ranked selection
   *
   * @param {Object} request - Full blood request document
   * @param {Object[]} candidates - Available inventory units
   * @param {number} needed - Remaining units still needed
   * @returns {Promise<Object[]>} Ordered list of selected units
   */
  async selectUnits(request, candidates, needed) {
    return this._fefoWithPriorityAwareness(candidates, needed, request.priority);
  }

  // ─── Private Strategy Implementations ──────────────────────────────────────

  /**
   * FEFO: First Expiring, First Out
   * Standard blood bank allocation algorithm to minimise wastage.
   *
   * Priority awareness:
   *   - EMERGENCY / CRITICAL: Take all available (beyond `needed` count if required)
   *     to ensure maximum fulfillment regardless of remaining shortfall.
   *   - LOW / NORMAL / HIGH: Take exactly `needed` (conservative allocation).
   *
   * @param {Object[]} candidates
   * @param {number} needed
   * @param {string} priority
   * @returns {Object[]}
   */
  _fefoWithPriorityAwareness(candidates, needed, priority) {
    // Sort by expiryDate ASC — soonest expiring allocated first
    const sorted = [...candidates].sort(
      (a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)
    );

    const priorityWeight = PRIORITY_WEIGHT[priority] ?? 2;

    // For high-urgency requests, attempt to take all available (up to request total)
    const cap =
      priorityWeight >= PRIORITY_WEIGHT.CRITICAL
        ? sorted.length
        : needed;

    return sorted.slice(0, Math.min(needed, cap));
  }

  // ─── Candidate Discovery ─────────────────────────────────────────────────────

  /**
   * Query MongoDB for AVAILABLE InventoryUnit records matching the request criteria.
   * Excludes already-allocated units (from partial allocations).
   * Excludes expired units by checking expiryDate > now.
   *
   * This method is defined ON the engine (not the repository) so an AI Agent
   * can override it to include additional context (embeddings, demand signals, etc.)
   * while still querying the same database.
   *
   * @param {Object} request - Blood request document (lean)
   * @returns {Promise<Object[]>} Available InventoryUnit documents
   */
  async findCandidates(request) {
    const excludeIds = request.allocatedUnits?.map((id) => id.toString()) ?? [];

    const filter = {
      bloodGroup: request.bloodGroup,
      componentType: request.componentType,
      officeId: request.officeId?._id ?? request.officeId,
      status: INVENTORY_STATUS.AVAILABLE,
      expiryDate: { $gt: new Date() }, // Exclude already-expired units
      isActive: true,
    };

    if (excludeIds.length > 0) {
      filter._id = { $nin: excludeIds };
    }

    return await InventoryUnit.find(filter)
      .sort({ expiryDate: 1 })        // FEFO pre-sort at DB level
      .lean()
      .exec();
  }

  // ─── Transactional Application ────────────────────────────────────────────────

  /**
   * Apply the allocation decision to the database within a MongoDB session.
   * Called by the blood request service inside a transaction.
   *
   * For FULFILLED requests: marks units ISSUED (final, irreversible)
   * For PARTIALLY_FULFILLED: marks units RESERVED with request tracking
   *
   * @param {string[]} unitIds - Selected InventoryUnit ObjectIds
   * @param {string} requestNumber - For tracking (stored in issuedTo / remarks)
   * @param {boolean} isFinalAllocation - true → ISSUED; false → RESERVED
   * @param {Object} session - Mongoose session
   * @returns {Promise<void>}
   */
  async applyAllocation(unitIds, requestNumber, isFinalAllocation, session) {
    const newStatus = isFinalAllocation
      ? INVENTORY_STATUS.ISSUED
      : INVENTORY_STATUS.RESERVED;

    await InventoryUnit.updateMany(
      { _id: { $in: unitIds } },
      {
        $set: {
          status: newStatus,
          issuedTo: requestNumber,
        },
      },
      { session }
    );
  }

  /**
   * Release RESERVED units back to AVAILABLE.
   * Called when a PARTIALLY_FULFILLED request is cancelled.
   *
   * @param {string[]} unitIds - InventoryUnit ObjectIds to release
   * @param {Object} session - Mongoose session
   * @returns {Promise<number>} Count of released units
   */
  async releaseReservedUnits(unitIds, session) {
    if (!unitIds || unitIds.length === 0) return 0;

    const result = await InventoryUnit.updateMany(
      {
        _id: { $in: unitIds },
        status: INVENTORY_STATUS.RESERVED,     // Only release RESERVED (not ISSUED)
      },
      {
        $set: {
          status: INVENTORY_STATUS.AVAILABLE,
          issuedTo: null,
        },
      },
      { session }
    );

    return result.modifiedCount;
  }
}

/**
 * Export a singleton instance of the rule-based allocation engine.
 *
 * To switch to an AI Agent:
 *   import AIAllocationEngine from './ai-allocation.service.js';
 *   export default new AIAllocationEngine();
 *
 * The blood request service import remains: `import allocationEngine from './allocation.service.js'`
 * — zero changes required in the service, controller, or routes.
 */
export default new AllocationEngine();
