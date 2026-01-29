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

    // state ปัจจุบัน
    currentHole: { type: Number, min: 1, max: 18, default: null },
    rounds: { type: Number, default: 0, min: 0 }, // นับจำนวนครั้งที่เลือกหลุม
    activeBookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },

    //pace แบบปรับตัว
    pacePerHoleMin: { type: Number, default: 17, min: 5, max: 60 }, // นาที/หลุม (ค่าโดยประมาณ)
    lastHoleStartedAt: { type: Date, default: null }, // เวลาเริ่มหลุม "ปัจจุบัน"
  },
  { timestamps: true }
);

const Caddy = mongoose.model("Caddy", caddySchema);
export default Caddy;
