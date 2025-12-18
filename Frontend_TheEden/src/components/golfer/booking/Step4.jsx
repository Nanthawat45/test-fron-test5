// src/components/golfer/booking/Step4.jsx
import React, { useMemo, useState } from "react";
import LoadingAnimation from "../animations/LoadingAnimation.jsx";
import { calculatePriceBreakdown } from "../../../service/calculatePrice.js";

export default function Step4({
  bookingData,
  onPrev,
  onSubmit,                 // ✅ รับ callback จากหน้า Booking
  isLoading: isLoadingFromParent = false,
}) {
  const [error, setError] = useState("");

  const {
    courseType = "-",
    date,
    timeSlot = "-",
    players = 0,
    groupName = "",
    caddy: rawCaddy = [],
    golfCartQty: rawCart = 0,
    golfBagQty: rawBag = 0,
  } = bookingData || {};

  const caddy = Array.isArray(rawCaddy) ? rawCaddy : [];
  const golfCartQty = Number(rawCart ?? 0);
  const golfBagQty = Number(rawBag ?? 0);

  const { greenFee, caddyFee, cartFee, bagFee, total } = useMemo(
    () =>
      calculatePriceBreakdown({
        courseType,
        players: Number(players ?? 0),
        caddy,
        golfCartQty,
        golfBagQty,
        date,
      }),
    [courseType, players, caddy, golfCartQty, golfBagQty, date]
  );

  // ตรวจข้อมูลให้ครบก่อนส่ง onSubmit
  const handleClick = async () => {
    try {
      setError("");
      if (!date || !timeSlot || !players) {
        throw new Error("ข้อมูลไม่ครบ กรุณากรอกให้ครบถ้วน");
      }
      if (!Array.isArray(caddy) || caddy.length !== Number(players)) {
        throw new Error(`จำนวนแคดดี้ต้องเท่ากับจำนวนผู้เล่น (${players} คน)`);
      }
      if (!total || Number(total) <= 0) {
        throw new Error("ยอดชำระไม่ถูกต้อง");
      }
      if (typeof onSubmit === "function") {
        await onSubmit();
      }
    } catch (e) {
      setError(e?.message || "เกิดข้อผิดพลาด");
    }
  };

  const disabled = Boolean(isLoadingFromParent);

  return (
    <div className="max-w-md mx-auto p-6 bg-white/60 backdrop-blur-lg rounded-3xl border border-neutral-200/40 ring-1 ring-white/30 shadow-md">
      <h2 className="text-[22px] font-th text-neutral-900 text-center mb-6">Step 4: สรุปและตรวจสอบ</h2>

      <div className="text-neutral-800 space-y-1.5 mb-6 text-[15px]">
        <p><span className="text-neutral-500">ประเภทคอร์ส:</span> {courseType} หลุม</p>
        <p>
          <span className="text-neutral-500">วันที่:</span>{" "}
          {date ? new Date(date).toLocaleDateString("th-TH") : "-"}
        </p>
        <p><span className="text-neutral-500">เวลา:</span> {timeSlot}</p>
        <p><span className="text-neutral-500">จำนวนผู้เล่น:</span> {players} คน</p>
        <p><span className="text-neutral-500">ชื่อกลุ่ม:</span> {groupName || "-"}</p>
        <p><span className="text-neutral-500">แคดดี้:</span> {Array.isArray(caddy) && caddy.length > 0 ? `${caddy.length} คน` : "-"}</p>
        <p><span className="text-neutral-500">รถกอล์ฟ:</span> {golfCartQty} คัน</p>
        <p><span className="text-neutral-500">ถุงกอล์ฟ:</span> {golfBagQty} ถุง</p>
      </div>

      <div className="rounded-2xl bg-white/70 border border-neutral-200 p-4 mb-6">
        <h3 className="text-[16px] font-th text-neutral-900 mb-2">รายละเอียดค่าใช้จ่าย</h3>
        <ul className="text-neutral-800 text-[15px] space-y-1">
          <li>• Green Fee: {Number(greenFee).toLocaleString()} บาท</li>
          <li>• Caddy: {Number(caddyFee).toLocaleString()} บาท</li>
          <li>• Cart: {Number(cartFee).toLocaleString()} บาท</li>
          <li>• Golf Bag: {Number(bagFee).toLocaleString()} บาท</li>
        </ul>
        <div className="h-px bg-neutral-200 my-3" />
        <h3 className="text-xl font-th text-emerald-700">
          รวมทั้งหมด: {Number(total).toLocaleString()} บาท
        </h3>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-4">
          <p className="text-sm text-red-700">
            <span className="font-medium">เกิดข้อผิดพลาด:</span> {error}
          </p>
        </div>
      )}
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-4">
        <p className="text-sm text-emerald-800">โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนดำเนินการชำระเงิน</p>
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={onPrev}
          disabled={disabled}
          className="px-6 py-2 rounded-full font-th bg-neutral-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ย้อนกลับ
        </button>

        <button
          onClick={handleClick}
          disabled={disabled}
          className={[
            "px-6 py-2 rounded-full font-th flex items-center gap-2 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            disabled ? "bg-neutral-300 text-neutral-600" : "bg-emerald-600 text-white hover:bg-emerald-700",
          ].join(" ")}
        >
          {disabled ? (
            <>
              <LoadingAnimation />
              <span>กำลังประมวลผล...</span>
            </>
          ) : (
            <>ดำเนินการชำระเงิน</>
          )}
        </button>
      </div>
    </div>
  );
}
