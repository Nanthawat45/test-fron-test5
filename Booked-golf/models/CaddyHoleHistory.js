// models/CaddyHoleHistory.js
import mongoose from "mongoose";

const caddyHoleHistorySchema = new mongoose.Schema(
  {
    caddyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    holeNumber: { type: Number, required: true, min: 1, max: 18 },
    order: { type: Number, required: true, min: 1 }, // ลำดับครั้งที่เลือก 1..9/18

    enteredAt: { type: Date, default: Date.now, index: true }, // เวลาเริ่มหลุม
    leftAt: { type: Date, default: null }, // เวลาออกจากหลุม
    durationMin: { type: Number, default: null }, // นาทีที่ใช้ในหลุมนั้น
  },
  { timestamps: true }
);

// ช่วย query ล่าสุดของ caddy+booking ได้ไว
caddyHoleHistorySchema.index({ caddyId: 1, bookingId: 1, enteredAt: -1 });

const CaddyHoleHistory = mongoose.model("CaddyHoleHistory", caddyHoleHistorySchema);
export default CaddyHoleHistory;
