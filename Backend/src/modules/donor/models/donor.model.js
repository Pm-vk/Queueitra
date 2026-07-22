import mongoose from "mongoose";

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const VALID_GENDERS = ["Male", "Female", "Other"];

const donorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Donor name is required"],
      trim: true,
    },

    /**
     * Email is optional but must be unique if provided.
     * sparse: true allows multiple documents to omit email
     * while still enforcing uniqueness among those that have it.
     */
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      index: true,
    },

    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"],
    },

    gender: {
      type: String,
      enum: {
        values: VALID_GENDERS,
        message: "{VALUE} is not a valid gender. Accepted: Male, Female, Other",
      },
    },

    bloodGroup: {
      type: String,
      enum: {
        values: VALID_BLOOD_GROUPS,
        message: "{VALUE} is not a valid blood group",
      },
      index: true,
    },

    /**
     * Weight stored in kilograms.
     * Minimum 50 kg is a hard eligibility requirement.
     */
    weight: {
      type: Number,
      min: [0, "Weight cannot be negative"],
    },

    /**
     * Height stored in centimetres.
     */
    height: {
      type: Number,
      min: [0, "Height cannot be negative"],
    },

    lastDonationDate: {
      type: Date,
      default: null,
    },

    /**
     * Arrays — stored as trimmed strings.
     * Empty array is the safe default for medical history fields.
     */
    medicalConditions: {
      type: [String],
      default: [],
    },

    currentMedications: {
      type: [String],
      default: [],
    },

    allergies: {
      type: [String],
      default: [],
    },

    address: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
      index: true,
    },

    state: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
    },

    pincode: {
      type: String,
      trim: true,
    },

    officeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      required: [true, "Office assignment is required"],
      index: true,
    },

    /**
     * Computed by the service layer on every create/update.
     * Age >= 18 AND weight >= 50 AND isActive === true
     */
    isEligible: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator reference is required"],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ────────────────────────────────────────────────────────────────

// Compound index to speed up office + eligibility filtered queries
donorSchema.index({ officeId: 1, isEligible: 1, isActive: 1 });

// Compound index for city-based eligible donor lookups
donorSchema.index({ city: 1, bloodGroup: 1, isEligible: 1 });

// Text index for full-text search on name
donorSchema.index({ name: "text" });

// Export valid blood groups for reuse in validation layer
export { VALID_BLOOD_GROUPS, VALID_GENDERS };

const Donor = mongoose.model("Donor", donorSchema);

export default Donor;
