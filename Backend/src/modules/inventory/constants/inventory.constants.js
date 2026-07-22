// ─── Component Types ──────────────────────────────────────────────────────────

export const COMPONENT_TYPE = Object.freeze({
  WHOLE_BLOOD: "WHOLE_BLOOD",
  PACKED_RBC: "PACKED_RBC",
  PLASMA: "PLASMA",
  PLATELETS: "PLATELETS",
  CRYOPRECIPITATE: "CRYOPRECIPITATE",
});

export const COMPONENT_TYPE_VALUES = Object.values(COMPONENT_TYPE);

// ─── Inventory Status ─────────────────────────────────────────────────────────

export const INVENTORY_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  ISSUED: "ISSUED",
  TRANSFERRED: "TRANSFERRED",
  EXPIRED: "EXPIRED",
  DISCARDED: "DISCARDED",
});

export const INVENTORY_STATUS_VALUES = Object.values(INVENTORY_STATUS);

/**
 * Terminal statuses: no further status changes are allowed once reached,
 * except EXPIRED → DISCARDED which is the only cleanup path.
 */
export const TERMINAL_INVENTORY_STATUSES = [
  INVENTORY_STATUS.ISSUED,
  INVENTORY_STATUS.DISCARDED,
];

/**
 * Legal state machine transitions.
 * Rules:
 *   - ISSUED units CANNOT return to AVAILABLE (blood integrity rule)
 *   - DISCARDED units cannot change to any other status
 *   - EXPIRED units can only be DISCARDED
 *   - TRANSFERRED units are re-assessed at the destination (can become AVAILABLE)
 */
export const ALLOWED_INVENTORY_TRANSITIONS = Object.freeze({
  [INVENTORY_STATUS.AVAILABLE]: [
    INVENTORY_STATUS.RESERVED,
    INVENTORY_STATUS.ISSUED,
    INVENTORY_STATUS.TRANSFERRED,
    INVENTORY_STATUS.EXPIRED,
    INVENTORY_STATUS.DISCARDED,
  ],
  [INVENTORY_STATUS.RESERVED]: [
    INVENTORY_STATUS.AVAILABLE,  // Released
    INVENTORY_STATUS.ISSUED,
    INVENTORY_STATUS.TRANSFERRED,
    INVENTORY_STATUS.EXPIRED,
    INVENTORY_STATUS.DISCARDED,
  ],
  [INVENTORY_STATUS.ISSUED]: [],        // Terminal
  [INVENTORY_STATUS.TRANSFERRED]: [
    INVENTORY_STATUS.AVAILABLE,         // Received at destination
    INVENTORY_STATUS.EXPIRED,
    INVENTORY_STATUS.DISCARDED,
  ],
  [INVENTORY_STATUS.EXPIRED]: [
    INVENTORY_STATUS.DISCARDED,         // Cleanup only
  ],
  [INVENTORY_STATUS.DISCARDED]: [],     // Terminal
});

// ─── Expiry Days Per Component Type ──────────────────────────────────────────

/**
 * Storage shelf life in days from collection date.
 * Based on standard blood bank guidelines.
 */
export const COMPONENT_EXPIRY_DAYS = Object.freeze({
  [COMPONENT_TYPE.WHOLE_BLOOD]: 35,
  [COMPONENT_TYPE.PACKED_RBC]: 42,
  [COMPONENT_TYPE.PLASMA]: 365,
  [COMPONENT_TYPE.PLATELETS]: 5,
  [COMPONENT_TYPE.CRYOPRECIPITATE]: 365,
});

/**
 * Map from donation types (what donors give) to component types (what gets stored).
 * Used in the donation completion workflow to determine the correct inventory component.
 */
export const DONATION_TYPE_TO_COMPONENT = Object.freeze({
  WHOLE_BLOOD: COMPONENT_TYPE.WHOLE_BLOOD,
  PLASMA: COMPONENT_TYPE.PLASMA,
  PLATELETS: COMPONENT_TYPE.PLATELETS,
  DOUBLE_RED_CELLS: COMPONENT_TYPE.PACKED_RBC,
});

// ─── Near-Expiry Threshold ────────────────────────────────────────────────────

/** Units expiring within this many days are flagged as "near expiry" */
export const NEAR_EXPIRY_DAYS = 7;

// ─── Blood Unit ID ────────────────────────────────────────────────────────────

export const BLOOD_UNIT_ID_PREFIX = "BU";

// ─── Allowed Sort Fields ──────────────────────────────────────────────────────

export const ALLOWED_INVENTORY_SORT_FIELDS = [
  "expiryDate",
  "collectionDate",
  "bloodGroup",
  "volume",
  "createdAt",
];
