import mongoose from "mongoose";

const caddySchema = new mongoose.Schema(
  {
    caddy_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    caddyStatus: {
      type: String,
      enum: ["available", "booked", "onGoing", "clean", "resting", "unavailable"],
      default: "available",
    },

    // ✅ เพิ่ม state สำหรับ “รายงานหลุม/เปลี่ยนหลุม”
    currentHole: { type: Number, min: 1, max: 18, default: null }, // หลุมที่อยู่ล่าสุด
    rounds: { type: Number, default: 0, min: 0 }, // นับจำนวนครั้งที่ย้ายหลุมจริง
    activeBookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null }, // กันกดข้าม booking
  },
  { timestamps: true }
);

const Caddy = mongoose.model("Caddy", caddySchema);
export default Caddy;
