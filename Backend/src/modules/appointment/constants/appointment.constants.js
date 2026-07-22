/**
 * Appointment status enum values.
 * Flow: SCHEDULED → CONFIRMED → CHECKED_IN → COMPLETED
 *       Any active status → CANCELLED
 *       Any active status → NO_SHOW
 */
export const APPOINTMENT_STATUS = Object.freeze({
  SCHEDULED: "SCHEDULED",
  CONFIRMED: "CONFIRMED",
  CHECKED_IN: "CHECKED_IN",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
});

export const APPOINTMENT_STATUS_VALUES = Object.values(APPOINTMENT_STATUS);

/**
 * Statuses that represent an appointment which is still alive and upcoming.
 */
export const ACTIVE_STATUSES = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
];

/**
 * Statuses that represent a completed or dead appointment.
 */
export const TERMINAL_STATUSES = [
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
];

/**
 * Legal status transitions.
 * Only the keys listed here can move to the values listed.
 * Empty array = terminal — no further transitions allowed.
 */
export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  [APPOINTMENT_STATUS.SCHEDULED]: [
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW,
  ],
  [APPOINTMENT_STATUS.CONFIRMED]: [
    APPOINTMENT_STATUS.CHECKED_IN,
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW,
  ],
  [APPOINTMENT_STATUS.CHECKED_IN]: [
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.COMPLETED]: [],
  [APPOINTMENT_STATUS.CANCELLED]: [],
  [APPOINTMENT_STATUS.NO_SHOW]: [],
});

/**
 * Maximum number of appointments allowed per office per time slot.
 * Can be overridden per office in the future by adding a field to Office model.
 */
export const DEFAULT_MAX_SLOT_CAPACITY = 10;

/**
 * Allowed sort fields for appointment list queries.
 */
export const ALLOWED_SORT_FIELDS = ["appointmentDate", "createdAt"];
