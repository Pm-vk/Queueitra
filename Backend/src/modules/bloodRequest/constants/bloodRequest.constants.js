// ─── Priority Levels ──────────────────────────────────────────────────────────

export const REQUEST_PRIORITY = Object.freeze({
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
  EMERGENCY: "EMERGENCY",
});

export const REQUEST_PRIORITY_VALUES = Object.values(REQUEST_PRIORITY);

/**
 * Priority weights used by the allocation engine for scoring.
 * Higher weight = allocated first when multiple requests compete for the same unit.
 */
export const PRIORITY_WEIGHT = Object.freeze({
  [REQUEST_PRIORITY.LOW]: 1,
  [REQUEST_PRIORITY.NORMAL]: 2,
  [REQUEST_PRIORITY.HIGH]: 3,
  [REQUEST_PRIORITY.CRITICAL]: 4,
  [REQUEST_PRIORITY.EMERGENCY]: 5,
});

// ─── Request Status ───────────────────────────────────────────────────────────

export const REQUEST_STATUS = Object.freeze({
  PENDING: "PENDING",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  PARTIALLY_FULFILLED: "PARTIALLY_FULFILLED",
  FULFILLED: "FULFILLED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
});

export const REQUEST_STATUS_VALUES = Object.values(REQUEST_STATUS);

/** Terminal statuses — no further transitions allowed */
export const TERMINAL_REQUEST_STATUSES = [
  REQUEST_STATUS.FULFILLED,
  REQUEST_STATUS.REJECTED,
  REQUEST_STATUS.CANCELLED,
];

/**
 * Legal status transitions for the blood request state machine.
 *
 * PENDING       → UNDER_REVIEW, APPROVED, REJECTED, CANCELLED
 * UNDER_REVIEW  → APPROVED, REJECTED, CANCELLED
 * APPROVED      → PARTIALLY_FULFILLED, FULFILLED, CANCELLED
 * PARTIALLY_FULFILLED → FULFILLED, CANCELLED
 * FULFILLED     → (terminal)
 * REJECTED      → (terminal)
 * CANCELLED     → (terminal)
 */
export const ALLOWED_REQUEST_TRANSITIONS = Object.freeze({
  [REQUEST_STATUS.PENDING]: [
    REQUEST_STATUS.UNDER_REVIEW,
    REQUEST_STATUS.APPROVED,
    REQUEST_STATUS.REJECTED,
    REQUEST_STATUS.CANCELLED,
  ],
  [REQUEST_STATUS.UNDER_REVIEW]: [
    REQUEST_STATUS.APPROVED,
    REQUEST_STATUS.REJECTED,
    REQUEST_STATUS.CANCELLED,
  ],
  [REQUEST_STATUS.APPROVED]: [
    REQUEST_STATUS.PARTIALLY_FULFILLED,
    REQUEST_STATUS.FULFILLED,
    REQUEST_STATUS.CANCELLED,
  ],
  [REQUEST_STATUS.PARTIALLY_FULFILLED]: [
    REQUEST_STATUS.FULFILLED,
    REQUEST_STATUS.CANCELLED,
  ],
  [REQUEST_STATUS.FULFILLED]: [],
  [REQUEST_STATUS.REJECTED]: [],
  [REQUEST_STATUS.CANCELLED]: [],
});

/** Statuses that allow inventory allocation to proceed */
export const ALLOCATABLE_STATUSES = [
  REQUEST_STATUS.APPROVED,
  REQUEST_STATUS.PARTIALLY_FULFILLED,
];

/** Statuses from which a STAFF member can cancel their own request */
export const STAFF_CANCELLABLE_STATUSES = [
  REQUEST_STATUS.PENDING,
  REQUEST_STATUS.UNDER_REVIEW,
];

// ─── Blood Groups ─────────────────────────────────────────────────────────────

export const VALID_BLOOD_GROUPS = Object.freeze([
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
]);

// ─── Request Number ───────────────────────────────────────────────────────────

export const REQUEST_NUMBER_PREFIX = "BR";

// ─── Allowed Sort Fields ──────────────────────────────────────────────────────

export const ALLOWED_REQUEST_SORT_FIELDS = [
  "createdAt",
  "requiredBefore",
  "priority",
  "status",
];

// ─── Patient Gender ───────────────────────────────────────────────────────────

export const PATIENT_GENDER_VALUES = ["Male", "Female", "Other"];
