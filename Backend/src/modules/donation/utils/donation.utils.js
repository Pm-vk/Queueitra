import ApiError from "../../../utils/ApiError.js";
import { VITAL_RANGES, VOLUME_LIMITS } from "../constants/donation.constants.js";

/**
 * Validate that the donation volume is within the acceptable range
 * for the given donation type.
 *
 * @param {string} donationType
 * @param {number} volume - mL
 */
export function validateVolume(donationType, volume) {
  const limits = VOLUME_LIMITS[donationType];
  if (!limits) return; // Unknown type — model enum catches this

  if (volume < limits.min || volume > limits.max) {
    throw new ApiError(
      400,
      `Volume ${volume} mL is out of range for ${donationType}. ` +
        `Acceptable: ${limits.min}–${limits.max} mL`
    );
  }
}

/**
 * Validate hemoglobin level against physiological safe range.
 * @param {number|undefined} level - g/dL
 */
export function validateHemoglobin(level) {
  if (level === undefined || level === null) return;
  const { min, max } = VITAL_RANGES.hemoglobin;
  if (level < min || level > max) {
    throw new ApiError(
      400,
      `Hemoglobin level ${level} g/dL is outside the safe range (${min}–${max} g/dL)`
    );
  }
}

/**
 * Validate blood pressure readings (systolic and diastolic).
 * @param {{ systolic?: number, diastolic?: number }|undefined} bp
 */
export function validateBloodPressure(bp) {
  if (!bp) return;

  if (bp.systolic !== undefined && bp.systolic !== null) {
    const { min, max } = VITAL_RANGES.systolicBP;
    if (bp.systolic < min || bp.systolic > max) {
      throw new ApiError(
        400,
        `Systolic BP ${bp.systolic} mmHg is outside safe range (${min}–${max} mmHg)`
      );
    }
  }

  if (bp.diastolic !== undefined && bp.diastolic !== null) {
    const { min, max } = VITAL_RANGES.diastolicBP;
    if (bp.diastolic < min || bp.diastolic > max) {
      throw new ApiError(
        400,
        `Diastolic BP ${bp.diastolic} mmHg is outside safe range (${min}–${max} mmHg)`
      );
    }
  }

  // Physiological sanity check: systolic must exceed diastolic
  if (
    bp.systolic !== undefined &&
    bp.diastolic !== undefined &&
    bp.systolic <= bp.diastolic
  ) {
    throw new ApiError(
      400,
      "Systolic blood pressure must be greater than diastolic blood pressure"
    );
  }
}

/**
 * Validate pulse (heart rate) in bpm.
 * @param {number|undefined} pulse
 */
export function validatePulse(pulse) {
  if (pulse === undefined || pulse === null) return;
  const { min, max } = VITAL_RANGES.pulse;
  if (pulse < min || pulse > max) {
    throw new ApiError(
      400,
      `Pulse ${pulse} bpm is outside safe range (${min}–${max} bpm)`
    );
  }
}

/**
 * Validate body temperature in Celsius.
 * @param {number|undefined} temp
 */
export function validateTemperature(temp) {
  if (temp === undefined || temp === null) return;
  const { min, max } = VITAL_RANGES.temperature;
  if (temp < min || temp > max) {
    throw new ApiError(
      400,
      `Temperature ${temp}°C is outside safe range (${min}–${max}°C). ` +
        `Donation rejected to protect donor safety`
    );
  }
}

/**
 * Validate donor weight at collection time.
 * Minimum 50 kg is required for safe donation.
 * @param {number|undefined} weight - kg
 */
export function validateWeight(weight) {
  if (weight === undefined || weight === null) return;
  const { min } = VITAL_RANGES.weight;
  if (weight < min) {
    throw new ApiError(
      400,
      `Donor weight ${weight} kg is below the minimum required ${min} kg`
    );
  }
}

/**
 * Run all vital sign validations in a single call.
 * Called by the service whenever donation data is created or updated.
 *
 * @param {Object} vitals
 * @param {string} donationType - Required for volume range lookup
 */
export function validateAllVitals(vitals, donationType) {
  const {
    volume,
    hemoglobinLevel,
    bloodPressure,
    pulse,
    temperature,
    weight,
  } = vitals;

  if (volume !== undefined && donationType) {
    validateVolume(donationType, volume);
  }
  validateHemoglobin(hemoglobinLevel);
  validateBloodPressure(bloodPressure);
  validatePulse(pulse);
  validateTemperature(temperature);
  validateWeight(weight);
}
