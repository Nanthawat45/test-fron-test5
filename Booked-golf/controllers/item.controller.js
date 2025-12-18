import Item from "../models/Item.js";
import Booking from "../models/Booking.js";
import { buildThaiDayRange, formatThaiTodayForResponse } from "../controllers/booking.Controller.js";


export const createItem = async (req, res) => {
    const { itemId, type } = req.body;
    try {
        const itemExists = await Item.findOne({ itemId });
        if (itemExists) {
            return res.status(400).json({ message: "Item already exists" });//มีรายการอยู่แล้ว
        }
        const item = new Item({
            itemId,
            type,
            status: 'available'
        });
        const savedItem = await item.save();
        res.status(201).json(savedItem);
    } catch {
        res.status(500).json({ message: "Server error" }); //เซิร์ฟเวอร์ error
    }
}

export const getByIdItem = async (req, res) => {
    const { id } = req.params;
    try {
        const bookedById = await Item.findById(id);
        if (!bookedById) {
            return res.status(404).json({ message: "Booking not found" });//ไม่พบการจอง
        }
        res.send(bookedById);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });//เซิร์ฟเวอร์ error
    }
};

export const deleteItem = async (req, res) => {
    try {
        const DItem = await Item.findById(req.params.id);
        // console.log(DItem);
        if (!DItem) {
            return res.status(404).json({ message: "Item not found" });//ไม่พบการจอง
        }
        await DItem.deleteOne();
        res.status(200).json({ message: "Item deleted successfully" });//ลบการจองสำเร็จ
    } catch {
        res.status(500).json({ message: "Server error" });//เซิร์ฟเวอร์ error
    }
}

export const getItemCar = async (req, res) => {
    try {
        const Items = await Item.find({ type: "golfCar" })
        //.populate('Item', 'itemId type status')
        // .populate('bookedGolfCartIds', 'name')
        // .populate('bookedGolfBagIds', 'name')
        res.json(Items);
    } catch {
        res.status(500).json({ message: "Server error" });//เซิร์ฟเวอร์ error
    }
};

export const getItemBag = async (req, res) => {
    try {
        const Items = await Item.find({ type: "golfBag" })
        //.populate('Item', 'itemId type status')
        // .populate('bookedGolfCartIds', 'name')
        // .populate('bookedGolfBagIds', 'name')
        res.json(Items);
    } catch {
        res.status(500).json({ message: "Server error" });//เซิร์ฟเวอร์ error
    }
};

export const checkItem = async (quantity, itemType) => {
    try {
        if (quantity <= 0) {
            return [];
        }
        const items = await Item.find({
            type: itemType,
            status: "available"
        }).limit(quantity);
        const itemId = items.map(item => item.id);
        await Item.updateMany(
            { _id: { $in: itemId } },
            { $set: { status: "booked" } }
        )
        return itemId
    } catch {
        res.status(500).json({ message: "Server error" });//เซิร์ฟเวอร์ error
    }
}

export const updateItemStatus = async (itemIds, newStatus) => {
    try {
        await Item.updateMany(
            { _id: { $in: itemIds } },
            { $set: { status: newStatus } }
        );
    } catch (error) {
        throw new Error(`Failed to update item status: ${error.message}`);
    }
};

export const updateItemStatusinUse = async (itemIds, newStatus) => {
    try {
        await Item.updateMany(
            { _id: { $in: itemIds } },
            { $set: { status: newStatus } }
        );
    } catch (error) {
        throw new Error(`Failed to update item status: ${error.message}`);
    }
};

// export const getItemAllStatus = async (req, res) => {
//     try {
//         const itemStatuses = await Item.aggregate([ // ใช้ aggregate เพื่อจัดกลุ่มและนับสถานะ
//             {
//                 $group: {
//                     _id: { type: "$type", status: "$status" }, // จัดกลุ่มตาม type และ status
//                     count: { $sum: 1 } // นับจำนวน //เพิ่ม 1 ทุกครั้ง
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0, // ไม่แสดง _id ในผลลัพธ์
//                     type: "$_id.type", // ดึง type จาก _id ออกมาจาก $ group
//                     status: "$_id.status", // ดึง status จาก _id ออกมาจาก $ group
//                     count: 1
//                 }
//             }
//         ]);

//         const golfCarSummary = {
//             booked: 0,
//             inUse: 0,
//             clean: 0,
//             available: 0,
//             spare: 0,
//             broken: 0
//         };
//         const golfBagSummary = {
//             booked: 0,
//             inUse: 0,
//             clean: 0,
//             available: 0,
//             spare: 0,
//             broken: 0
//         };

//         itemStatuses.forEach(item => {
//             if (item.type === 'golfCar') {
//                 golfCarSummary[item.status] = item.count;
//             } else if (item.type === 'golfBag') {
//                 golfBagSummary[item.status] = item.count;
//             }
//         });

//         res.status(200).json({
//             golfCar: golfCarSummary,
//             golfBag: golfBagSummary
//         });

//     } catch (error) {
//         console.error("Error fetching item overall status:", error); // เกิดข้อผิดพลาดในการดึงสถานะโดยรวมของ item
//         res.status(500).json({ error: error.message || "Failed to fetch item overall status." }); // ดึงสถานะโดยรวมของ item ไม่สำเร็จ
//     }
// };

export const syncAndGetItemAllStatus = async (req, res) => {
  try {
    // ✅ รับ date ได้ทั้ง body และ query (ไม่ส่ง = วันนี้ไทย)
    const dateStr = req.body?.date || req.query?.date || null;
    const usedDate = dateStr || formatThaiTodayForResponse();
    const { startTH, endTH } = buildThaiDayRange(dateStr);

    // 1) ดึง booking ของวันนั้น (ไม่นับ canceled)
    const bookings = await Booking.find({
      date: { $gte: startTH, $lte: endTH },
      status: { $ne: "canceled" },
    }).select("golfCar golfBag");

    // 2) รวมจำนวนที่จองทั้งหมดของวันนั้น
    let totalCar = 0;
    let totalBag = 0;
    for (const b of bookings) {
      totalCar += Number(b.golfCar || 0);
      totalBag += Number(b.golfBag || 0);
    }

    // 3) รีเซ็ตเป็น available ทั้งหมดก่อน (ตามที่คุณต้องการ "วันใหม่ต้องว่างถ้าไม่มีจอง")
    await Item.updateMany({ type: "golfCar" }, { $set: { status: "available" } });
    await Item.updateMany({ type: "golfBag" }, { $set: { status: "available" } });

    // 4) เลือก item ตามจำนวน แล้ว set เป็น booked
    const bookSome = async (type, qty) => {
      if (qty <= 0) return 0;

      const items = await Item.find({ type })
        .sort({ itemId: 1 }) // เลือกแบบคงที่
        .limit(qty)
        .select("_id");

      const ids = items.map((it) => it._id);
      if (ids.length > 0) {
        await Item.updateMany(
          { _id: { $in: ids } },
          { $set: { status: "booked" } }
        );
      }
      return ids.length;
    };

    const bookedCar = await bookSome("golfCar", totalCar);
    const bookedBag = await bookSome("golfBag", totalBag);

    // 5) ✅ ทำ summary แบบเดิม (ยกของคุณมาใช้เหมือนเดิม)
    const itemStatuses = await Item.aggregate([
      {
        $group: {
          _id: { type: "$type", status: "$status" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          type: "$_id.type",
          status: "$_id.status",
          count: 1,
        },
      },
    ]);

    const golfCarSummary = {
      booked: 0,
      inUse: 0,
      clean: 0,
      available: 0,
      spare: 0,
      broken: 0,
    };
    const golfBagSummary = {
      booked: 0,
      inUse: 0,
      clean: 0,
      available: 0,
      spare: 0,
      broken: 0,
    };

    itemStatuses.forEach((item) => {
      if (item.type === "golfCar") {
        golfCarSummary[item.status] = item.count;
      } else if (item.type === "golfBag") {
        golfBagSummary[item.status] = item.count;
      }
    });

    // ส่งกลับ: summary เดิม + ข้อมูล booking ของวันนั้น (ช่วย debug/แสดงผล)
    return res.status(200).json({
      date: usedDate,
      bookingCount: bookings.length,
    //   bookedFromBooking: {
    //     golfCar: totalCar,
    //     golfBag: totalBag,
    //   },
    //   bookedUpdated: {
    //     golfCar: bookedCar,
    //     golfBag: bookedBag,
    //   },
      golfCar: golfCarSummary,
      golfBag: golfBagSummary,
    });
  } catch (error) {
    console.error("Error syncAndGetItemAllStatus:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to sync and fetch item overall status." });
  }
};
