// ─── Donation Types ───────────────────────────────────────────────────────────

export const DONATION_TYPE = Object.freeze({
  WHOLE_BLOOD: "WHOLE_BLOOD",
  PLASMA: "PLASMA",
  PLATELETS: "PLATELETS",
  DOUBLE_RED_CELLS: "DOUBLE_RED_CELLS",
});

export const DONATION_TYPE_VALUES = Object.values(DONATION_TYPE);

// ─── Donation Status ──────────────────────────────────────────────────────────

export const DONATION_STATUS = Object.freeze({
  SCHEDULED: "SCHEDULED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
});

export const DONATION_STATUS_VALUES = Object.values(DONATION_STATUS);

/** Statuses that block further modification */
export const TERMINAL_DONATION_STATUSES = [
  DONATION_STATUS.COMPLETED,
  DONATION_STATUS.FAILED,
  DONATION_STATUS.REJECTED,
];

/**
 * Legal status transitions for the donation state machine.
 * Empty array = terminal — no further transitions allowed.
 */
export const ALLOWED_DONATION_STATUS_TRANSITIONS = Object.freeze({
  [DONATION_STATUS.SCHEDULED]: [
    DONATION_STATUS.IN_PROGRESS,
    DONATION_STATUS.FAILED,
    DONATION_STATUS.REJECTED,
  ],
  [DONATION_STATUS.IN_PROGRESS]: [
    DONATION_STATUS.COMPLETED,
    DONATION_STATUS.FAILED,
    DONATION_STATUS.REJECTED,
  ],
  [DONATION_STATUS.COMPLETED]: [],
  [DONATION_STATUS.FAILED]: [],
  [DONATION_STATUS.REJECTED]: [],
});

// ─── Volume Limits (mL) ───────────────────────────────────────────────────────

/**
 * Configurable volume range per donation type.
 * Used for validation in the service layer.
 */
export const VOLUME_LIMITS = Object.freeze({
  [DONATION_TYPE.WHOLE_BLOOD]: { min: 350, max: 550 },
  [DONATION_TYPE.PLASMA]: { min: 400, max: 800 },
  [DONATION_TYPE.PLATELETS]: { min: 200, max: 400 },
  [DONATION_TYPE.DOUBLE_RED_CELLS]: { min: 400, max: 500 },
});

// ─── Vital Signs Acceptable Ranges ───────────────────────────────────────────

export const VITAL_RANGES = Object.freeze({
  hemoglobin: { min: 12.5, max: 20.0 },     // g/dL
  systolicBP: { min: 90, max: 160 },         // mmHg
  diastolicBP: { min: 60, max: 100 },        // mmHg
  pulse: { min: 50, max: 100 },              // bpm
  temperature: { min: 36.0, max: 37.5 },    // °C
  weight: { min: 50 },                       // kg
});

// ─── Blood Inventory Expiry (days from collection) ────────────────────────────

export const BLOOD_EXPIRY_DAYS = Object.freeze({
  [DONATION_TYPE.WHOLE_BLOOD]: 42,
  [DONATION_TYPE.PLASMA]: 365,
  [DONATION_TYPE.PLATELETS]: 5,
  [DONATION_TYPE.DOUBLE_RED_CELLS]: 42,
});

// ─── Blood Inventory Status ───────────────────────────────────────────────────

export const INVENTORY_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  USED: "USED",
  EXPIRED: "EXPIRED",
  DISCARDED: "DISCARDED",
});

export const INVENTORY_STATUS_VALUES = Object.values(INVENTORY_STATUS);

// ─── Allowed Sort Fields ──────────────────────────────────────────────────────

export const ALLOWED_DONATION_SORT_FIELDS = [
  "collectionTime",
  "createdAt",
  "volume",
];
