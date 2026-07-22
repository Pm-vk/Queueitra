import mongoose from "mongoose";
import {
  DONATION_TYPE_VALUES,
  DONATION_STATUS_VALUES,
  DONATION_STATUS,
} from "../constants/donation.constants.js";

const donationSchema = new mongoose.Schema(
  {
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donor",
      required: [true, "Donor reference is required"],
      index: true,
    },

    /**
     * The appointment this donation is linked to.
     * A unique index ensures only one donation record per appointment.
     */
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: [true, "Appointment reference is required"],
      unique: true,
      index: true,
    },

    officeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      required: [true, "Office reference is required"],
      index: true,
    },

    /**
     * The staff member (User with STAFF role) performing the donation.
     */
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Staff reference is required"],
      index: true,
    },

    bloodGroup: {
      type: String,
      required: [true, "Blood group is required"],
      index: true,
    },

    donationType: {
      type: String,
      enum: {
        values: DONATION_TYPE_VALUES,
        message: "{VALUE} is not a valid donation type",
      },
      required: [true, "Donation type is required"],
      index: true,
    },

    /**
     * Volume collected in millilitres.
     * Must be within configurable limits per donation type (enforced in service).
     */
    volume: {
      type: Number,
      required: [true, "Volume is required"],
      min: [1, "Volume must be a positive number"],
    },

    hemoglobinLevel: {
      type: Number,
      min: [0, "Hemoglobin level must be positive"],
    },

    /**
     * Blood pressure stored as a sub-document for structured querying.
     * Both systolic and diastolic are optional individually but
     * validated together in the service layer.
     */
    bloodPressure: {
      systolic: {
        type: Number,
        min: [0, "Systolic blood pressure must be positive"],
      },
      diastolic: {
        type: Number,
        min: [0, "Diastolic blood pressure must be positive"],
      },
    },

    pulse: {
      type: Number,
      min: [0, "Pulse must be positive"],
    },

    /**
     * Body temperature in degrees Celsius.
     */
    temperature: {
      type: Number,
      min: [0, "Temperature must be positive"],
    },

    /**
     * Donor weight (kg) at time of donation — may differ from profile weight.
     * Stored here for the donation record's integrity.
     */
    weight: {
      type: Number,
      min: [0, "Weight must be positive"],
    },

    status: {
      type: String,
      enum: {
        values: DONATION_STATUS_VALUES,
        message: "{VALUE} is not a valid donation status",
      },
      default: DONATION_STATUS.SCHEDULED,
      index: true,
    },

    remarks: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * The date and time the collection physically started.
     * Distinct from appointmentDate — records the actual start of the procedure.
     */
    collectionTime: {
      type: Date,
      default: null,
    },

    /**
     * Timestamp set atomically when status transitions to COMPLETED.
     */
    completedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator reference is required"],
      index: true,
    },

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

// Date + status compound index for efficient listing and history queries
donationSchema.index({ collectionTime: -1, status: 1 });

// Office-level reporting index
donationSchema.index({ officeId: 1, status: 1, collectionTime: -1 });

// Blood group + type search index
donationSchema.index({ bloodGroup: 1, donationType: 1 });

const Donation = mongoose.model("Donation", donationSchema);

export default Donation;
