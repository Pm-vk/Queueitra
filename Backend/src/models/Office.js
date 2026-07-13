import mongoose from "mongoose";

const officeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Office name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    officeType: {
      type: String,
      required: [true, "Office type is required"],
      enum: {
        values: ["Government", "Hospital", "Bank", "University", "Private", "Other"],
        message: "{VALUE} is not a valid office type",
      },
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
    latitude: {
      type: Number,
      min: [-90, "Latitude must be between -90 and 90"],
      max: [90, "Latitude must be between -90 and 90"],
    },
    longitude: {
      type: Number,
      min: [-180, "Longitude must be between -180 and 180"],
      max: [180, "Longitude must be between -180 and 180"],
    },
    openingTime: {
      type: String,
      required: [true, "Opening time is required"],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Opening time must be in HH:MM (24-hour) format",
      ],
    },
    closingTime: {
      type: String,
      required: [true, "Closing time is required"],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Closing time must be in HH:MM (24-hour) format",
      ],
    },
    workingDays: {
      type: [String],
      required: [true, "Working days are required"],
      validate: {
        validator: function (days) {
          const validDays = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ];
          return days.every((day) => validDays.includes(day));
        },
        message: "workingDays contains one or more invalid weekday strings",
      },
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

// Indexes
// Compound index for coordinate checks
officeSchema.index({ latitude: 1, longitude: 1 });
// Text index on name and city for search queries
officeSchema.index({ name: "text", city: "text" });
// Index on officeType for quick categorization filtering
officeSchema.index({ officeType: 1 });

const Office = mongoose.model("Office", officeSchema);

export default Office;
