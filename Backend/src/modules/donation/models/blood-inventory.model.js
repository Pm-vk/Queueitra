import mongoose from "mongoose";
import { INVENTORY_STATUS, INVENTORY_STATUS_VALUES } from "../constants/donation.constants.js";
import { DONATION_TYPE_VALUES } from "../constants/donation.constants.js";

/**
 * BloodInventory model — auto-created when a Donation reaches COMPLETED status.
 * Represents a unit of blood/component ready for use.
 *
 * This model lives inside the donation module for now.
 * It can be extracted to a standalone Inventory module in the future
 * without any changes to the donation module.
 */
const bloodInventorySchema = new mongoose.Schema(
  {
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation",
      required: [true, "Donation reference is required"],
      unique: true, // One inventory record per donation
      index: true,
    },

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
     */
    volume: {
      type: Number,
      required: [true, "Volume is required"],
      min: [1, "Volume must be positive"],
    },

    collectedAt: {
      type: Date,
      required: [true, "Collection timestamp is required"],
    },

    /**
     * Expiry date is calculated based on the donation type's shelf life.
     * See BLOOD_EXPIRY_DAYS in constants.
     */
    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: true,
    },

    status: {
      type: String,
      enum: {
        values: INVENTORY_STATUS_VALUES,
        message: "{VALUE} is not a valid inventory status",
      },
      default: INVENTORY_STATUS.AVAILABLE,
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

// Compound index for available blood by type + group — critical for matching queries
bloodInventorySchema.index({ bloodGroup: 1, donationType: 1, status: 1, expiresAt: 1 });

// Office-level inventory query index
bloodInventorySchema.index({ officeId: 1, status: 1, bloodGroup: 1 });

const BloodInventory = mongoose.model("BloodInventory", bloodInventorySchema);

export default BloodInventory;
