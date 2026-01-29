import mongoose from "mongoose";

const caddyHoleProgressSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    caddyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    holeNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 18,
    },

    order: {
      type: Number, // ลำดับที่เลือก 1,2,3,...
      required: true,
    },

    selectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/**
 * ❌ กันแคดดี้คนเดิมเลือกหลุมเดิมซ้ำใน booking เดียว
 */
caddyHoleProgressSchema.index(
  { bookingId: 1, caddyId: 1, holeNumber: 1 },
  { unique: true }
);

/**
 * ❌ กันชน: หลุมเดียวกัน ห้ามมีหลายแคดดี้ใน booking เดียว
 * (ถ้าอยากให้ 1 หลุมมีหลายคน → ลบ index นี้ออก)
 */
caddyHoleProgressSchema.index(
  { bookingId: 1, holeNumber: 1 },
  { unique: true }
);

const CaddyHoleProgress = mongoose.model(
  "CaddyHoleProgress",
  caddyHoleProgressSchema
);

export default CaddyHoleProgress;
