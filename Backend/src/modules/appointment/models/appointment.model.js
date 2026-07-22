import mongoose from "mongoose";
import { APPOINTMENT_STATUS_VALUES, APPOINTMENT_STATUS } from "../constants/appointment.constants.js";

const appointmentSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donor",
      required: [true, "Donor reference is required"],
      index: true,
    },

    officeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      required: [true, "Office reference is required"],
      index: true,
    },

    /**
     * Optional staff member assigned to handle this appointment.
     * References the User collection — the logged-in STAFF user's ID.
     * Can be assigned at booking time or added/changed later.
     */
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /**
     * The calendar date of the appointment (date-only, normalized to midnight UTC).
     * Time is stored separately in timeSlot for cleaner querying.
     */
    appointmentDate: {
      type: Date,
      required: [true, "Appointment date is required"],
      index: true,
    },

    /**
     * Time slot in HH:MM 24-hour format (e.g., "09:30", "14:00").
     * Must fall within the office's openingTime and closingTime.
     */
    timeSlot: {
      type: String,
      required: [true, "Time slot is required"],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Time slot must be in HH:MM (24-hour) format",
      ],
    },

    status: {
      type: String,
      enum: {
        values: APPOINTMENT_STATUS_VALUES,
        message: "{VALUE} is not a valid appointment status",
      },
      default: APPOINTMENT_STATUS.SCHEDULED,
      index: true,
    },

    /**
     * Free-text field for staff/admin notes about the appointment.
     */
    remarks: {
      type: String,
      trim: true,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator reference is required"],
      index: true,
    },

    /**
     * Soft delete flag. Cancelled appointments are NOT deleted —
     * isActive is set to false to preserve history.
     */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ────────────────────────────────────────────────────────────────

/**
 * Unique compound index prevents a donor from having two active appointments
 * at the same office on the same date and time slot.
 * The partial filter ensures this only applies to non-cancelled records.
 */
appointmentSchema.index(
  { donorId: 1, appointmentDate: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"] },
    },
    name: "unique_active_donor_slot",
  }
);

/**
 * Compound index for office-level slot capacity queries.
 * Used to count bookings per office per date per slot.
 */
appointmentSchema.index({ officeId: 1, appointmentDate: 1, timeSlot: 1, status: 1 });

/**
 * Compound index for date-range + status filtered listing queries.
 */
appointmentSchema.index({ appointmentDate: 1, status: 1, isActive: 1 });

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;
