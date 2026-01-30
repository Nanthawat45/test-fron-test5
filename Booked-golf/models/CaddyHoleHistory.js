import mongoose from "mongoose";

const caddyHoleHistorySchema = new mongoose.Schema(
  {
    caddyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },

    holeNumber: { type: Number, required: true, min: 1, max: 18 },

    enteredAt: { type: Date, default: Date.now }, // เวลาเริ่มหลุมนั้น
    leftAt: { type: Date, default: null },        // เวลาออกจากหลุมนั้น (จะ set ตอนเปลี่ยนหลุม/จบรอบ)
  },
  { timestamps: true }
);

caddyHoleHistorySchema.index({ caddyId: 1, bookingId: 1, enteredAt: -1 });

const CaddyHoleHistory = mongoose.model("CaddyHoleHistory", caddyHoleHistorySchema);
export default CaddyHoleHistory;
