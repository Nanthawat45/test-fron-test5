import Caddy from "../models/Caddy.js";
import Booking from "../models/Booking.js";
import { updateBookingStatus  } from "./booking.Controller.js"
import { updateItemStatus } from "./item.controller.js";
import Hole from "../models/Hole.js";
import { startOfDay, endOfDay } from 'date-fns';
import CaddyHoleProgress from "../models/CaddyHoleProgress.js";
import CaddyHoleHistory from "../models/CaddyHoleHistory.js";
import mongoose from "mongoose";

export const startRound = async (req, res) => {
  const { bookingId } = req.params;
  const caddyId = req.user._id;

  try {
    const booking = await Booking.findById(bookingId);

    // 1. ตรวจสอบ: การจองมีอยู่จริงหรือไม่
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // 2. ตรวจสอบ: แคดดี้ที่ล็อกอินอยู่ได้รับมอบหมายให้กับการจองนี้หรือไม่
    if (booking.caddy && !booking.caddy.map(id => id.toString()).includes(caddyId.toString())) {
      return res.status(403).json({ message: "You are not assigned to this booking." });
    }

    // 3. เปลี่ยนสถานะของ Golf Carts และ Golf Bags จาก 'booked' เป็น 'inUse'
    const bookedAssetIds = [...(booking.bookedGolfCarIds || []), ...(booking.bookedGolfBagIds || [])];
    if (bookedAssetIds.length > 0) {
      await updateItemStatus(bookedAssetIds, 'inUse');
    }

    // 4. เปลี่ยนสถานะของแคดดี้ จาก 'booked' เป็น 'onGoing'
    await updateCaddyStatus(caddyId, 'onGoing');

    // 5. เปลี่ยนสถานะของ Booking จาก 'booked' เป็น 'onGoing'
    const bump = await checkUpdatedBookingStatus(bookingId, 'afterStart');

    res.status(200).json({
      message: "Round started successfully. All assets and caddies are now in use.",
      booking: bump
    });

  } catch (error) {
    console.error("Failed to start round:", error);
    res.status(400).json({ error: error.message || "Failed to start round." });
  }
};

export const updateCaddyStatus = async (caddyId, newStatus) => {
  try {
    await Caddy.updateOne(
      { caddy_id: caddyId },
      { $set: { caddyStatus: newStatus } }
    );
  } catch (error) {
    throw new Error(`Failed to update caddy status: ${error.message}`);
  }
};

export const updateCaddyBooking = async (caddyUserIds, newStatus) => {
  // caddyUserIds คือ array ของ User._id (จาก front)
  const objIds = (caddyUserIds || [])
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
 
  // ใช้ caddy_id ไม่ใช่ _id !!
  const result = await Caddy.updateMany(
    { caddy_id: { $in: objIds } },        // <<< สำคัญ
    { $set: { caddyStatus: newStatus } }
  );
 
  // console.log(" Caddy.updateMany:", {
  //   matchedCount: result.matchedCount,
  //   modifiedCount: result.modifiedCount,
  // });
 
  return result;
};

export const endRound = async (req, res) => {
  const { bookingId } = req.params;
  const caddyId = req.user._id;

  let bump = null;

  try {
    const booking = await Booking.findById(bookingId);

    // 1) ตรวจสอบ: การจองมีอยู่จริงหรือไม่
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // 2) ตรวจสอบ: แคดดี้ที่ล็อกอินอยู่ได้รับมอบหมายให้กับการจองนี้หรือไม่
    if (
      booking.caddy &&
      !booking.caddy.map((id) => id.toString()).includes(caddyId.toString())
    ) {
      return res.status(403).json({ message: "You are not assigned to this booking." });
    }

    // ✅ 3) ปิด history หลุมสุดท้ายก่อน (กัน leftAt ค้าง)
    try {
      const openRec = await CaddyHoleHistory.findOne({
        caddyId,
        bookingId: new mongoose.Types.ObjectId(bookingId),
        leftAt: null,
      }).sort({ enteredAt: -1 });

      if (openRec) {
        const leftAt = new Date();
        const diffMin = (leftAt.getTime() - new Date(openRec.enteredAt).getTime()) / 60000;
        openRec.leftAt = leftAt;
        openRec.durationMin = Math.max(0, Number(diffMin.toFixed(2)));
        await openRec.save();
      }
    } catch (e) {
      console.warn("Failed to close last hole history:", e?.message);
    }

    // 4) เปลี่ยนสถานะของ Golf Carts และ Golf Bags จาก 'booked' เป็น 'clean'
    const bookedAssetIds = [
      ...(booking.bookedGolfCarIds || []),
      ...(booking.bookedGolfBagIds || []),
    ];
    if (bookedAssetIds.length > 0) {
      await updateItemStatus(bookedAssetIds, "clean");
    }

    // 5) เปลี่ยนสถานะแคดดี้ (ตามระบบคุณใช้ clean)
    await updateCaddyStatus(caddyId, "clean");

    // 6) เปลี่ยนสถานะของ Booking ตาม logic เดิมของคุณ
    bump = await checkUpdatedBookingStatus(bookingId, "afterEnd");

    return res.status(200).json({
      message: "Round ended successfully. All assets and caddies are now set to clean.",
      booking: bump,
    });
  } catch (error) {
    console.error("Failed to end round:", error);
    return res.status(400).json({ error: error.message || "Failed to end round." });
  } finally {
    // ✅ เคลียร์ state ของ Caddy เสมอ (กันค้าง activeBookingId/currentHole)
    try {
      const caddyDoc = await Caddy.findOne({ caddy_id: caddyId });
      if (caddyDoc) {
        // เคลียร์เฉพาะเคสที่ activeBookingId ตรงกับรอบนี้ (ปลอดภัย)
        if (!caddyDoc.activeBookingId || String(caddyDoc.activeBookingId) === String(bookingId)) {
          caddyDoc.currentHole = null;
          caddyDoc.rounds = 0;
          caddyDoc.activeBookingId = null;

          // ถ้าคุณใช้ pace/eta
          caddyDoc.lastHoleStartedAt = null;
          caddyDoc.pacePerHoleMin = 17;

          await caddyDoc.save();
        }
      }
    } catch (e) {
      console.warn("Failed to clear caddy state in finally:", e?.message);
    }
  }
};

export const markCaddyAsAvailable = async (req, res) => {
  const { bookingId } = req.params;
  const caddyId = req.user._id;

  try {
    const booking = await Booking.findById(bookingId);

    // 1. ตรวจสอบ: การจองมีอยู่จริงหรือไม่
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // 2. ตรวจสอบ: แคดดี้ที่ล็อกอินอยู่ได้รับมอบหมายให้กับการจองนี้หรือไม่
    if (
      booking.caddy &&
      !booking.caddy.map((id) => id.toString()).includes(caddyId.toString())
    ) {
      return res.status(403).json({ message: "You are not assigned to this booking." });
    }

    // 3. เปลี่ยนสถานะของ Golf Carts และ Golf Bags เป็น 'available'
    const bookedAssetIds = [
      ...(booking.bookedGolfCarIds || []),
      ...(booking.bookedGolfBagIds || []),
    ];
    if (bookedAssetIds.length > 0) {
      await updateItemStatus(bookedAssetIds, "available");
    }

    // 4) เปลี่ยนสถานะของแคดดี้เป็น available (ของเดิมคุณ)
    const updatedCaddy = await updateCaddyStatus(caddyId, "available");

    // 5) ✅ เคลียร์ state ที่ใช้กับ selectHole เพื่อเริ่มรอบใหม่ได้
    const caddyDoc = await Caddy.findOne({ caddy_id: caddyId });
    if (caddyDoc) {
      const lastHole = caddyDoc.currentHole;

      // (optional) ถ้าอยากล้าง report ที่หลุมล่าสุดด้วย (กันข้อมูลค้างบนหลุม)
      if (lastHole) {
        await Hole.updateOne(
          { holeNumber: lastHole },
          { $pull: { caddyReports: { caddyId } } }
        );
      }

      caddyDoc.activeBookingId = null;
      caddyDoc.currentHole = null;
      caddyDoc.rounds = 0;
      await caddyDoc.save();
    }

    return res.status(200).json({
      message: "Caddy and related assets are now available. State cleared.",
      caddy: updatedCaddy,
      clearedState: true,
    });
  } catch (error) {
    console.error("Failed to mark caddy available:", error);
    return res
      .status(400)
      .json({ error: error.message || "Failed to mark caddy available." });
  }
};

export const cancelStart = async (req, res) => {
  const { bookingId } = req.params;
  const caddyId = req.user._id;

  try {
    const booking = await Booking.findById(bookingId);

    // 1. ตรวจสอบ: การจองมีอยู่จริงหรือไม่
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // 2. ตรวจสอบ: แคดดี้ที่ล็อกอินอยู่ได้รับมอบหมายให้กับการจองนี้หรือไม่
    if (booking.caddy && !booking.caddy.map(id => id.toString()).includes(caddyId.toString())) {
      return res.status(403).json({ message: "You are not assigned to this booking." });
    }

    // 3. เปลี่ยนสถานะของ Golf Carts และ Golf Bags จาก 'booked' เป็น 'available'
    const bookedAssetIds = [...(booking.bookedGolfCarIds || []), ...(booking.bookedGolfBagIds || [])];
    if (bookedAssetIds.length > 0) {
      await updateItemStatus(bookedAssetIds, 'available');
    }

    // 4. เปลี่ยนสถานะของแคดดี้ จาก 'booked' เป็น 'available'
    await updateCaddyStatus(caddyId, 'available');

    // 5. เปลี่ยนสถานะของ Booking จาก 'booked' เป็น 'canceled'
    const bump = await checkUpdatedBookingStatus(bookingId, 'afterCancel');

    res.status(200).json({
      message: "Round canceled successfully. All assets and caddies are now available.",
      booking: bump
    });

  } catch (error) {
    console.error("Failed to start round:", error);
    res.status(400).json({ error: error.message || "Failed to start round." });
  }
};

export const cancelDuringRound = async (req, res) => {
  const { bookingId } = req.params;
  const caddyId = req.user._id;

  try {
    const booking = await Booking.findById(bookingId);

    // 1. ตรวจสอบ: การจองมีอยู่จริงหรือไม่
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // 2. ตรวจสอบ: แคดดี้ที่ล็อกอินอยู่ได้รับมอบหมายให้กับการจองนี้หรือไม่
    if (booking.caddy && !booking.caddy.map(id => id.toString()).includes(caddyId.toString())) {
      return res.status(403).json({ message: "You are not assigned to this booking." });
    }

    // 3. เปลี่ยนสถานะของ Golf Carts และ Golf Bags จาก 'booked' เป็น 'clean'
    const bookedAssetIds = [...(booking.bookedGolfCarIds || []), ...(booking.bookedGolfBagIds || [])];
    if (bookedAssetIds.length > 0) {
      await updateItemStatus(bookedAssetIds, 'clean');
    }

    // 4. เปลี่ยนสถานะของแคดดี้ จาก 'booked' เป็น 'clean'
    await updateCaddyStatus(caddyId, 'clean');

    // 5. เปลี่ยนสถานะของ Booking จาก 'booked' เป็น 'canceled'
    const bump = await checkUpdatedBookingStatus(bookingId, 'afterCancel');

    res.status(200).json({
      message: "Round canceled successfully. All assets and caddies are now available.",
      booking: bump
    });

  } catch (error) {
    console.error("Failed to start round:", error);
    res.status(400).json({ error: error.message || "Failed to start round." });
  }
};

export const getCaddyAvailable = async (req, res) => {
  try {
    const dateStr = req.body?.date || null; // 'YYYY-MM-DD' หรือ null
    const { startTH, endTH } = buildThaiDayRange(dateStr);

    // หา booking ของ "วันนั้น" (ตามเวลาไทย) ที่ยังไม่จบ
    const bookedBookings = await Booking.find({
      date: { $gte: startTH, $lte: endTH },
      status: { $in: ["pending", "booked", "onGoing"] },
    }).select("caddy");

    // รวม userId ของแคดดี้ที่ถูกจองแล้ว (booking.caddy เก็บเป็น userId)
    const exclude = new Set();
    for (const b of bookedBookings) {
      if (Array.isArray(b.caddy)) {
        for (const uid of b.caddy) exclude.add(String(uid));
      }
    }
    const excludeIds = Array.from(exclude);

    // เลือกเฉพาะแคดดี้ที่ยังไม่ถูกจอง (เปรียบเทียบกับ caddy.caddy_id = User._id)
    const raw = await Caddy.find({ caddy_id: { $nin: excludeIds } })
      .select("caddy_id name")
      .populate("caddy_id", "img");

    // ส่งผลลัพธ์แบบ "compatible ของเก่า" + กันพัง
    const list = raw.map(c => {
      const userId = String(c?.caddy_id?._id || c?.caddy_id || "");
      const img = c?.caddy_id?.img || "";
      const name = c?.name || "-";
      return {
        // legacy (ของเก่าต้องมี)
        _id: userId,
        img,
        // กันพังเวลาหน้าบ้าน filter ด้วย name.toLowerCase()
        name,
        // เผื่อใช้งานต่อ
        caddy_id: userId,
        caddyDocId: String(c._id),
        profilePic: img,
      };
    });

    return res.status(200).json(list);
  } catch (error) {
    console.error("getCaddyAvailable error:", error);
    return res.status(500).json({ message: "Failed to get available caddies" });
  }
};

export const getCaddyBooking = async (req, res) => {
    const caddyId = req.user._id; // ID ของแคดดี้ที่ล็อกอินอยู่

    try {
        const bookings = await Booking.find({ // ค้นหา Booking ที่มีแคดดี้คนนี้ถูกมอบหมาย
            caddy: caddyId, //caddy ต้องตรงกับ caddyId ที่ล็อกอินอยู่
        })
        .select('courseType date timeSlot groupName status') // เลือกเฉพาะ field ที่ต้องการ
        .sort({ date: 1, timeSlot: 1 }); // เรียงตามวันที่และเวลา //.sort การเรียงลำดับ
        // 1 คือ เรียงจากน้อยไปมาก (Ascending) -1 คือ เรียงจากมากไปน้อย (Descending)
        // แล้วถ้าวันที่เหมือนกัน ก็จะเรียงตาม เวลาที่จอง
        if (!bookings || bookings.length === 0) { 
            return res.status(404).json({ message: "No assigned bookings found." }); 
            // ถ้าไม่พบการจองที่แคดดี้ถูกมอบหมาย ให้ส่งข้อความว่าไม่พบการจอง
        }
        res.status(200).json(bookings); // ส่งข้อมูลการจองที่แคดดี้ถูกมอบหมายกลับไปยังผู้ใช้

    } catch (error) {
        res.status(500).json({ error: error.message || "Failed to fetch assigned bookings." });
        // ไม่สามารถรับการจองที่ ถูกมอบหมายได้
        // ส่งข้อความแสดงข้อผิดพลาดกลับไปยังผู้ใช้
    }
};

export const checkUpdatedBookingStatus = async (bookingId, phase) => {
  if (!mongoose.isValidObjectId(bookingId)) {
    return { updated: false, reason: 'invalid bookingId' };
  }

  const booking = await Booking.findById(bookingId).select('status caddy').lean();
  if (!booking) return { updated: false, reason: 'booking not found' };

  // รองรับทั้งแบบเก็บเป็น ObjectId ตรงๆ หรือเป็น subdoc { caddy } / { caddy_id }
  let caddyIds = [];
  if (Array.isArray(booking.caddy)) {
    caddyIds = booking.caddy.map(item => {
      if (mongoose.isValidObjectId(item)) return item;
      if (item?.caddy) return item.caddy;
      if (item?.caddy_id) return item.caddy_id;
      return null;
    }).filter(Boolean);
  }

  if (caddyIds.length === 0) {
    return { updated: false, reason: 'this booking has no caddies' };
  }

  // ดึงสถานะแคดดี้จริง
  const caddies = await Caddy.find({ caddy_id: { $in: caddyIds } })
    .select('caddy_id caddyStatus')
    .lean();

  // คนที่ "ไม่นับ" = ยกเลิกแล้ว
  const cancelStates = ['cancelStart', 'cancelDuringRound'];

  // เหลือเฉพาะคนที่ยัง active เพื่อนับเป็นยอดที่ต้องครบ
  const activeCaddies = caddies.filter(c => !cancelStates.includes(c.caddyStatus));
  const required = activeCaddies.length;

  // ถ้ายกเลิกหมด ⇒ booking = 'canceled'
  if (required === 0) {
    if (booking.status !== 'canceled') {
      const updated = await updateBookingStatus(bookingId, 'canceled');
      return { updated: true, phase, newStatus: updated.status, required: 0 };
    }
    return { updated: false, phase, reason: 'already canceled', required: 0 };
  }

  // “จบงาน” คือ clean (เพิ่ม 'resting' ได้ถ้าต้องการ)
  const endStates = ['clean'];

  if (phase === 'afterStart') {
    // เริ่มครบ = onGoing ของ active ครบตาม required
    const startedCount = activeCaddies.filter(c => c.caddyStatus === 'onGoing').length;

    if (startedCount >= required) {
      if (booking.status !== 'onGoing') {
        const updated = await updateBookingStatus(bookingId, 'onGoing');
        return { updated: true, phase, newStatus: updated.status, startedCount, required };
      }
      return { updated: false, phase, reason: 'already onGoing', startedCount, required };
    }
    return { updated: false, phase, reason: 'not all caddies onGoing', startedCount, required };
  }

  if (phase === 'afterEnd') {
    // จบครบ = อยู่ใน endStates ครบตาม required
    const finishedCount = activeCaddies.filter(c => endStates.includes(c.caddyStatus)).length;

    if (finishedCount >= required) {
      // ✅ ตามที่คุณต้องการ: end ครบ (หลังหัก cancel) ⇒ completed
      if (booking.status !== 'completed') {
        const updated = await updateBookingStatus(bookingId, 'completed');
        return { updated: true, phase, newStatus: updated.status, finishedCount, required };
      }
      return { updated: false, phase, reason: 'already completed', finishedCount, required };
    }
    return { updated: false, phase, reason: 'not all caddies finished', finishedCount, required };
  }

  if (phase === 'afterCancel') {
    // เงื่อนไข canceled ถูกเช็คไว้ข้างบนแล้ว
    return { updated: false, phase, reason: 'some caddies still active', required };
  }

  return { updated: false, reason: 'invalid phase' };
};

function buildThaiDayRange(dateStr /* 'YYYY-MM-DD' | null */) {
  if (dateStr) {
    const startTH = new Date(`${dateStr}T00:00:00.000+07:00`);
    const endTH   = new Date(`${dateStr}T23:59:59.999+07:00`);
    return { startTH, endTH };
  }
  const now = new Date();
  const thNow = new Date(now.getTime() + 7 * 60 * 60 * 1000); // ดันเป็นเวลาไทยชั่วคราวเพื่ออ่าน Y-M-D
  const y = thNow.getUTCFullYear();
  const m = String(thNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(thNow.getUTCDate()).padStart(2, "0");
  const startTH = new Date(`${y}-${m}-${d}T00:00:00.000+07:00`);
  const endTH   = new Date(`${y}-${m}-${d}T23:59:59.999+07:00`);
  return { startTH, endTH };
}

export const selectHole = async (req, res) => {
  const { bookingId, holeNumber } = req.body;
  const userId = req.user?._id;

  // ===== Config pace/slow (ถ้าคุณยังใช้ ETA/pace) =====
  const TARGET_INIT_PACE = 17;
  const SLOW_THRESHOLD_MIN = 25;
  const MIN_VALID_MIN = 3;
  const MAX_VALID_MIN = 40;
  const ALPHA = 0.2;

  // 0) validate
  if (!bookingId || !holeNumber) {
    return res.status(400).json({ message: "กรุณาส่ง bookingId และ holeNumber" });
  }
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ message: "bookingId ไม่ถูกต้อง" });
  }

  const nextHole = Number(holeNumber);
  if (!Number.isFinite(nextHole) || nextHole < 1 || nextHole > 18) {
    return res.status(400).json({ message: "holeNumber ต้องอยู่ระหว่าง 1-18" });
  }

  try {
    // 1) booking ต้องมีจริง + ต้อง onGoing
    const booking = await Booking.findById(bookingId).populate("caddy", "name");
    if (!booking) return res.status(404).json({ message: "ไม่พบ booking" });

    if (booking.status !== "onGoing") {
      return res.status(400).json({ message: "ยังไม่เริ่มรอบ (booking ต้องเป็น onGoing)" });
    }

    // 2) user ต้องเป็น caddy ของ booking
    const isInBooking = (booking.caddy || []).some(
      (u) => String(u?._id || u) === String(userId)
    );
    if (!isInBooking) {
      return res.status(403).json({ message: "คุณไม่ได้อยู่ในรายการแคดดี้ของ booking นี้" });
    }

    // 3) โหลด Caddy state
    const caddyDoc = await Caddy.findOne({ caddy_id: userId });
    if (!caddyDoc) return res.status(404).json({ message: "ไม่พบข้อมูล Caddy" });

    // กันข้าม booking
    if (caddyDoc.activeBookingId && String(caddyDoc.activeBookingId) !== String(booking._id)) {
      return res.status(400).json({ message: "คุณกำลังทำงานกับ booking อื่นอยู่" });
    }

    const prevHole = caddyDoc.currentHole; // อาจเป็น null
    const now = new Date();

    // 4) ห้ามเลือกหลุมเดิมติดกัน
    if (prevHole === nextHole) {
      return res.status(400).json({
        message: `คุณอยู่หลุม ${nextHole} อยู่แล้ว (ห้ามเลือกซ้ำติดกัน)`,
        data: { currentHole: prevHole, rounds: Number(caddyDoc.rounds || 0) },
      });
    }

    // 5) จำกัดจำนวนครั้งตาม courseType
    const maxMoves = booking.courseType === "9" ? 9 : 18;
    const rounds = Number(caddyDoc.rounds || 0);

    if (rounds >= maxMoves) {
      return res.status(400).json({
        message: `ครบ ${maxMoves} ครั้งแล้ว ไม่สามารถเลือกหลุมต่อได้`,
        data: { currentHole: prevHole || null, rounds, maxMoves },
      });
    }

    // 6) ✅ กันทับคนอื่นใน booking เดียวกัน (ดูจาก Caddy.currentHole)
    const conflict = await Caddy.findOne({
      caddy_id: { $ne: userId },
      activeBookingId: booking._id,
      currentHole: nextHole,
    }).lean();

    if (conflict) {
      return res.status(400).json({ message: `หลุม ${nextHole} มีแคดดี้อยู่แล้ว` });
    }

    // 7) ✅ ปิด history record ก่อนหน้า (ถ้ามี leftAt = null)
    const openRec = await CaddyHoleHistory.findOne({
      caddyId: userId,
      bookingId: booking._id,
      leftAt: null,
    }).sort({ enteredAt: -1 });

    let actualPrevHoleMin = null;
    let isSlowPrevHole = false;

    // 8) pace/ETA (ถ้าคุณใช้)
    const oldPace = Number(caddyDoc.pacePerHoleMin || TARGET_INIT_PACE);

    if (openRec) {
      // ปิด record เก่า
      const leftAt = now;
      const diffMin = (leftAt.getTime() - new Date(openRec.enteredAt).getTime()) / 60000;

      actualPrevHoleMin = Math.max(0, Number(diffMin.toFixed(2)));
      isSlowPrevHole = actualPrevHoleMin > SLOW_THRESHOLD_MIN;

      openRec.leftAt = leftAt;
      openRec.durationMin = actualPrevHoleMin;
      await openRec.save();

      // ปรับ pace เฉพาะเวลาที่สมเหตุสมผล
      if (actualPrevHoleMin >= MIN_VALID_MIN && actualPrevHoleMin <= MAX_VALID_MIN) {
        const newPace = oldPace * (1 - ALPHA) + actualPrevHoleMin * ALPHA;
        caddyDoc.pacePerHoleMin = Math.min(25, Math.max(10, Number(newPace.toFixed(2))));
      } else {
        caddyDoc.pacePerHoleMin = oldPace;
      }
    } else {
      // ครั้งแรก: ยังไม่มี record เก่า
      caddyDoc.pacePerHoleMin = oldPace;
    }

    const paceMin = Number(caddyDoc.pacePerHoleMin || TARGET_INIT_PACE);
    const etaNextAt = new Date(now.getTime() + paceMin * 60000);

    // 9) ✅ สร้าง history record ใหม่ของหลุมที่เพิ่งเลือก (เก็บ “ทั้งหมด”)
    await CaddyHoleHistory.create({
      caddyId: userId,
      bookingId: booking._id,
      holeNumber: nextHole,
      order: rounds + 1,
      enteredAt: now,
    });

    // 10) update state ของ Caddy (ถือว่าเริ่มหลุมใหม่ ณ ตอนนี้)
    caddyDoc.currentHole = nextHole;
    caddyDoc.rounds = rounds + 1;
    caddyDoc.activeBookingId = booking._id;
    caddyDoc.lastHoleStartedAt = now; // ถ้าคุณใช้
    caddyDoc.caddyStatus = "onGoing";

    await caddyDoc.save();

    return res.status(200).json({
      message: "เลือกหลุมสำเร็จ",
      data: {
        fromHole: prevHole || null,
        toHole: nextHole,
        rounds: caddyDoc.rounds,
        maxMoves,

        // pace/eta (ถ้าเอาไปโชว์)
        pacePerHoleMin: paceMin,
        etaNextAt,

        actualPrevHoleMin,
        isSlowPrevHole,
        slowThresholdMin: SLOW_THRESHOLD_MIN,
      },
    });
  } catch (err) {
    console.error("selectHole error:", err);
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};
// export const selectHole = async (req, res) => {
//   const { bookingId, holeNumber } = req.body;
//   const userId = req.user?._id;

//   if (!bookingId || !holeNumber) {
//     return res.status(400).json({ message: "กรุณาส่ง bookingId และ holeNumber" });
//   }

//   const nextHole = Number(holeNumber);
//   if (nextHole < 1 || nextHole > 18) {
//     return res.status(400).json({ message: "holeNumber ต้องอยู่ระหว่าง 1-18" });
//   }

//   try {
//     // 1) booking ต้อง onGoing
//     const booking = await Booking.findById(bookingId).populate("caddy");
//     if (!booking) return res.status(404).json({ message: "ไม่พบ booking" });
//     if (booking.status !== "onGoing") {
//       return res.status(400).json({ message: "booking ยังไม่อยู่ในสถานะ onGoing" });
//     }

//     // 2) ต้องเป็นแคดดี้ใน booking
//     const isCaddy = booking.caddy.some(
//       (c) => String(c._id) === String(userId)
//     );
//     if (!isCaddy) {
//       return res.status(403).json({ message: "คุณไม่ใช่แคดดี้ของ booking นี้" });
//     }

//     // 3) โหลด caddy
//     const caddy = await Caddy.findOne({ caddy_id: userId });
//     if (!caddy) return res.status(404).json({ message: "ไม่พบข้อมูล Caddy" });

//     // กันข้าม booking
//     if (
//       caddy.activeBookingId &&
//       String(caddy.activeBookingId) !== String(bookingId)
//     ) {
//       return res
//         .status(400)
//         .json({ message: "คุณกำลังทำงานกับ booking อื่นอยู่" });
//     }

//     // 4) นับจำนวนครั้งที่เลือกไปแล้ว
//     const usedCount = await CaddyHoleProgress.countDocuments({
//       bookingId,
//       caddyId: userId,
//     });

//     const maxMoves = booking.courseType === "9" ? 9 : 18;

//     if (usedCount >= maxMoves) {
//       return res.status(400).json({
//         message: `ครบ ${maxMoves} หลุมแล้ว`,
//         data: { usedCount, maxMoves },
//       });
//     }

//     // 5) กันชน: หลุมนี้มีคนอื่นเลือกไปแล้วหรือยัง
//     const exists = await CaddyHoleProgress.findOne({
//       bookingId,
//       holeNumber: nextHole,
//     });

//     if (exists) {
//       return res.status(400).json({
//         message: `หลุม ${nextHole} มีแคดดี้คนอื่นอยู่แล้ว`,
//       });
//     }

//     // 6) บันทึก progress (หัวใจ)
//     const progress = await CaddyHoleProgress.create({
//       bookingId,
//       caddyId: userId,
//       holeNumber: nextHole,
//       order: usedCount + 1,
//     });

//     // 7) อัปเดต caddy state
//     const prevHole = caddy.currentHole;
//     caddy.currentHole = nextHole;
//     caddy.activeBookingId = bookingId;
//     caddy.caddyStatus = "onGoing";
//     await caddy.save();

//     // 8) อัปเดต Hole dashboard (ย่อ logic ให้ชัด)
//     if (prevHole) {
//       await Hole.updateOne(
//         { holeNumber: prevHole },
//         {
//           $pull: {
//             caddyReports: { caddyId: userId },
//           },
//         }
//       );
//     }

//     await Hole.updateOne(
//       { holeNumber: nextHole },
//       {
//         bookingId,
//         groupName: booking.groupName,
//         status: "open",
//         $push: {
//           caddyReports: {
//             caddyId: userId,
//             caddyName: caddy.name,
//             bookingId,
//           },
//         },
//       }
//     );

//     return res.status(200).json({
//       message: "เลือกหลุมสำเร็จ",
//       data: {
//         fromHole: prevHole,
//         toHole: nextHole,
//         order: progress.order,
//         maxMoves,
//       },
//     });
//   } catch (err) {
//     console.error("selectHole error:", err);
//     return res.status(500).json({
//       message: err.code === 11000
//         ? "หลุมนี้ถูกเลือกไปแล้ว"
//         : "Server error",
//     });
//   }
// };