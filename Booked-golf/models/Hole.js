// models/Hole.js
import mongoose from "mongoose";

const holeSchema = new mongoose.Schema(
  {
    holeNumber: { type: Number, required: true, unique: true, min: 1, max: 18 },

    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },

    // snapshot หลักของ booking เพื่อโชว์บนหลุม
    groupName: { type: String },
    caddies: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    caddyNames: [{ type: String }],
    golfCarQty: { type: Number, default: 0 },
    golfBagQty: { type: Number, default: 0 },

    // ✅ รายงานตำแหน่งของแคดดี้ (รายงานซ้ำได้)
    caddyReports: [
      {
        caddyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        caddyName: { type: String },
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
        reportedAt: { type: Date, default: Date.now },
      },
    ],

    // ของเดิมคุณ
    description: { type: String },
    helpCarCount: { type: Number, default: 1, min: 1, max: 4 },
    status: {
      type: String,
      enum: ["open", "close", "editing", "help_car", "go_help_car"],
      default: "open",
    },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Hole = mongoose.model("Hole", holeSchema);
export default Hole;
