import { v4 as uuidv4 } from "uuid";
import { REQUEST_NUMBER_PREFIX } from "../constants/bloodRequest.constants.js";

/**
 * Generate a unique, human-readable Blood Request Number.
 *
 * Format: BR-{YYYYMMDD}-{8-char UUID fragment}
 * Example: BR-20260722-A3F7D2B1
 *
 * The date prefix aids in quick visual identification of when a request was made.
 * The UUID fragment guarantees uniqueness without a sequential counter.
 *
 * @returns {string}
 */
export function generateRequestNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const unique = uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${REQUEST_NUMBER_PREFIX}-${year}${month}${day}-${unique}`;
}

/**
 * Calculate the number of minutes between two dates.
 * Used for average fulfillment time calculations in the dashboard.
 *
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {number} Minutes
 */
export function minutesBetween(from, to) {
  return Math.abs(new Date(to) - new Date(from)) / (1000 * 60);
}
