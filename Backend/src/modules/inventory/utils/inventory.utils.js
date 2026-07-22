import { v4 as uuidv4 } from "uuid";
import {
  BLOOD_UNIT_ID_PREFIX,
  COMPONENT_EXPIRY_DAYS,
} from "../constants/inventory.constants.js";

/**
 * Generate a unique, human-readable Blood Unit ID.
 *
 * Format: BU-{2-digit-year}{2-digit-month}-{8-char-UUID-fragment}
 * Example: BU-2608-A3F7D2B1
 *
 * The year+month prefix helps with approximate traceability.
 * The UUID fragment guarantees uniqueness without a sequential counter.
 *
 * @returns {string}
 */
export function generateBloodUnitId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);   // "26"
  const month = String(now.getMonth() + 1).padStart(2, "0"); // "08"
  const unique = uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${BLOOD_UNIT_ID_PREFIX}-${year}${month}-${unique}`;
}

/**
 * Calculate the expiry date for a blood component based on its type.
 * Uses COMPONENT_EXPIRY_DAYS constants (in days from collection date).
 *
 * @param {string} componentType
 * @param {Date|string} collectionDate
 * @returns {Date} Calculated expiry date
 */
export function calculateExpiryDate(componentType, collectionDate) {
  const days = COMPONENT_EXPIRY_DAYS[componentType];
  if (days === undefined) {
    throw new Error(`Unknown component type for expiry calculation: ${componentType}`);
  }

  const expiry = new Date(collectionDate);
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Check whether a blood unit has passed its expiry date.
 * @param {Date|string} expiryDate
 * @returns {boolean}
 */
export function isExpired(expiryDate) {
  return new Date(expiryDate) < new Date();
}

/**
 * Check whether a blood unit is approaching expiry within a given threshold.
 * @param {Date|string} expiryDate
 * @param {number} thresholdDays
 * @returns {boolean}
 */
export function isNearExpiry(expiryDate, thresholdDays) {
  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + thresholdDays);
  const expiry = new Date(expiryDate);
  return expiry >= now && expiry <= threshold;
}
