import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Staff name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
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

    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
    },

    officeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Office",
      required: [true, "Office assignment is required"],
      index: true,
    },

    joiningDate: {
      type: Date,
      default: Date.now,
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

// Full-text search across name and designation
staffSchema.index({ name: "text", designation: "text" });

// Compound index for filtered office staff listings
staffSchema.index({ officeId: 1, isActive: 1 });

const Staff = mongoose.model("Staff", staffSchema);

export default Staff;
