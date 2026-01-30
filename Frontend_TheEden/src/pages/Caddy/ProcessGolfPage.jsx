// ✅ FILE: src/pages/Caddy/ProcessGolfPage.jsx
// (ดีไซน์เดิมทั้งหมด + เพิ่มล็อกหลุมที่มีแคดดี้อยู่จาก /hole/gethole)

import React, { useState, useEffect } from "react";
import Header from "../../components/Caddy/Header";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { useNavigate, useLocation } from "react-router-dom";
import CaddyService from "../../service/caddyService";
import api from "../../service/api"; // ✅ เพิ่ม: ใช้เรียก /hole/gethole

const ProcessGolfPage = () => {
  const [step, setStep] = useState(1);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // popup step 1
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  // popup step 2 และ 3
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showBatteryConfirm, setShowBatteryConfirm] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const {
    selectedDate: stateDate,
    selectedTime: stateTime,
    bookingId: stateBookingId,
  } = location.state || {};

  const [selectedDate, setSelectedDate] = useState(
    stateDate || localStorage.getItem("selectedDate") || "8 ก.พ ปี 2568"
  );
  const [selectedTime, setSelectedTime] = useState(
    stateTime || localStorage.getItem("selectedTime") || "06.00"
  );

  const [bookingId, setBookingId] = useState(stateBookingId || null);
  const [working, setWorking] = useState(false);

  // 🔥 state สำหรับ selectHole
  const [isOnGoing, setIsOnGoing] = useState(false);
  const [currentHole, setCurrentHole] = useState(null);
  const [rounds, setRounds] = useState(0);
  const [maxMoves, setMaxMoves] = useState(18);
  const [loadingHole, setLoadingHole] = useState(false);

  // ✅ เพิ่ม: หลุมที่มีแคดดี้อยู่ -> สีเทา + กดไม่ได้
  const [occupiedHoles, setOccupiedHoles] = useState(new Set());
  const [loadingOcc, setLoadingOcc] = useState(false);

  useEffect(() => {
    if (stateDate) localStorage.setItem("selectedDate", stateDate);
    if (stateTime) localStorage.setItem("selectedTime", stateTime);
  }, [stateDate, stateTime]);

  // ✅ พยายามหา bookingId ถ้าไม่ได้ส่งมาทาง state
  useEffect(() => {
    const fallbackFromMyBookings = async () => {
      if (bookingId) return;
      try {
        const { data } = await CaddyService.getCaddyBookings();
        if (Array.isArray(data) && data.length > 0) {
          setBookingId(data[0]._id);
        }
      } catch (e) {
        console.warn("ไม่พบ bookingId และไม่สามารถดึงรายการจองของแคดดี้ได้:", e);
      }
    };
    fallbackFromMyBookings();
  }, [bookingId]);

  const stepTexts = ["เริ่มออกรอบกอล์ฟ", "จบการเล่นกอล์ฟ", "เปลี่ยนแบตรถกอล์ฟสำเร็จ"];

  // ✅ ดึงหลุมที่มีแคดดี้อยู่จาก backend
  const fetchOccupiedHoles = async () => {
    try {
      setLoadingOcc(true);
      const { data } = await api.get("/hole/gethole");

      // getHoles ใหม่จะมี: { holeNumber, occupied, ... }
      const occ = new Set(
        (data || [])
          .filter((h) => !!h.occupied)
          .map((h) => Number(h.holeNumber))
          .filter((n) => Number.isFinite(n))
      );

      setOccupiedHoles(occ);
    } catch (e) {
      // ถ้าดึงไม่ได้ -> ไม่ล็อก (หลังบ้าน selectHole จะกันซ้ำอยู่แล้ว)
      setOccupiedHoles(new Set());
    } finally {
      setLoadingOcc(false);
    }
  };

  // ✅ ตอนอยู่ในโหมด onGoing ให้ refresh สถานะหลุมเรื่อยๆ
  useEffect(() => {
    if (!isOnGoing) return;

    fetchOccupiedHoles();
    const t = setInterval(fetchOccupiedHoles, 5000);
    return () => clearInterval(t);
  }, [isOnGoing]);

  // ==============================
  // STEP 1-3 (เดิม)
  // ==============================
  const handleNextStep = async () => {
    try {
      setWorking(true);

      if (step === 1) {
        // เริ่มรอบ
        if (bookingId) {
          await CaddyService.startRound(bookingId);

          // ✅ เข้าโหมดเลือกหลุมทันที
          setIsOnGoing(true);

          // ✅ โหลด occupied หลุมหลัง start
          fetchOccupiedHoles();
        } else {
          console.warn("ไม่มี bookingId: ข้ามการเรียก startRound แต่ยังไปสเต็ปถัดไป");
        }

        // ❗️เดิม: start แล้วเคย setStep(2) ต่อ แต่ตอนนี้เราจะ “ค้าง step 1”
        // เพื่อให้เลือกหลุมจนครบก่อน แล้วค่อยปลดล็อกไป step 2
        return;
      } else if (step === 2) {
        // จบรอบ
        if (bookingId) {
          await CaddyService.endRound(bookingId);
        } else {
          console.warn("ไม่มี bookingId: ข้ามการเรียก endRound แต่ยังไปสเต็ปถัดไป");
        }
      } else if (step === 3) {
        // ✅ สเต็ปสุดท้าย: ตั้งธง finalized
        if (bookingId) {
          try {
            localStorage.setItem(`finalized:${bookingId}`, "1");
          } catch (e) {
            console.warn("ตั้งค่า finalized ใน localStorage ไม่สำเร็จ:", e);
          }
        }

        navigate("/caddy", {
          state: { completedSchedule: { date: selectedDate, time: selectedTime } },
        });
        return;
      }

      if (step < 3) {
        setStep((s) => s + 1);
      }
    } catch (err) {
      console.error("ดำเนินการไม่สำเร็จ:", err);
      alert(
        step === 1
          ? "เริ่มออกรอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
          : step === 2
          ? "จบการเล่นไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
          : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setWorking(false);
    }
  };

  // ==============================
  // SELECT HOLE
  // ==============================
  const handleSelectHole = async (holeNumber) => {
    if (loadingHole) return;
    if (!bookingId) return alert("ไม่พบ bookingId");

    const hole = Number(holeNumber);

    // ✅ กันหน้าเว็บ: ถ้าหลุมมีแคดดี้อยู่ -> ห้ามเลือก
    // (ยกเว้นกรณีหลุมตัวเอง — แต่ปุ่มหลุมตัวเองจะเป็นเทาอยู่แล้ว)
    if (occupiedHoles.has(hole) && currentHole !== hole) {
      alert(`หลุม ${hole} มีแคดดี้อยู่แล้ว เลือกไม่ได้`);
      return;
    }

    try {
      setLoadingHole(true);

      const res = await CaddyService.selectHole({
        bookingId,
        holeNumber: hole,
      });

      // หลังบ้านตอบ: data: { fromHole, toHole, rounds, maxMoves }
      const { toHole, rounds: newRounds, maxMoves: mm } = res.data.data;

      setCurrentHole(toHole);
      setRounds(newRounds);
      setMaxMoves(Number(mm || 18));

      // ✅ refresh occupied หลุมอีกครั้ง
      fetchOccupiedHoles();

      // ✅ ครบแล้ว -> ปลดล็อก step 2
      if (newRounds >= Number(mm || 18)) {
        alert("ครบจำนวนหลุมแล้ว สามารถจบรอบได้");
        setStep(2);
      }
    } catch (err) {
      alert(err?.response?.data?.message || "เลือกหลุมไม่สำเร็จ");
      fetchOccupiedHoles();
    } finally {
      setLoadingHole(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-4 py-6 relative">
      <Header />

      {/* ✅ ปุ่ม “แจ้งปัญหา” ด้านขวาบน */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={() => navigate("/caddy/dashboard/start")}
          className="bg-black hover:bg-black text-white px-5 py-2 rounded-full shadow-md transition"
        >
          แจ้งปัญหา
        </button>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="flex items-center gap-4">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <div
                className={`w-9 h-9 flex items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  step > i
                    ? "bg-green-500 border-green-500 text-white"
                    : step === i
                    ? "bg-green-100 border-green-500 text-green-700"
                    : "bg-gray-100 border-gray-300 text-gray-400"
                }`}
              >
                {step > i ? <FontAwesomeIcon icon={faCheckCircle} /> : i}
              </div>
              {i < 3 && (
                <div
                  className={`w-10 h-[2px] ${
                    step > i ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <div className="bg-gradient-to-br from-green-700 to-green-800 text-white rounded-3xl w-full max-w-sm py-8 px-6 text-center shadow-lg">
          <p className="text-lg font-semibold">{stepTexts[step - 1]}</p>

          {/* ✅ โหมดเลือกหลุม (ยังอยู่ step 1) */}
          {step === 1 && isOnGoing && (
            <div className="mt-4 text-left">
              <div className="text-sm text-white/90 mb-2">
                เลือกหลุม ({rounds}/{maxMoves}){" "}
                {loadingOcc ? "(กำลังอัปเดต...)" : ""}
              </div>

              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: maxMoves }).map((_, i) => {
                  const hole = i + 1;

                  // ✅ หลุมที่มีแคดดี้อยู่ -> เทา + กดไม่ได้
                  const isOccupied = occupiedHoles.has(hole);

                  // ✅ หลุมที่เราอยู่ -> เทา + กดไม่ได้
                  const isMine = currentHole === hole;

                  const disabled = loadingHole || isOccupied || isMine;

                  return (
                    <button
                      key={hole}
                      disabled={disabled}
                      onClick={() => handleSelectHole(hole)}
                      className={`py-2 rounded text-sm font-semibold transition ${
                        disabled
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : "bg-white text-green-800 hover:bg-green-50"
                      }`}
                      title={
                        isMine
                          ? "หลุมที่คุณอยู่"
                          : isOccupied
                          ? "มีแคดดี้อยู่แล้ว"
                          : "เลือกหลุม"
                      }
                    >
                      {hole}
                    </button>
                  );
                })}
              </div>

              {currentHole && (
                <div className="mt-3 text-sm text-white/90">
                  หลุมปัจจุบัน: <span className="font-semibold">{currentHole}</span>
                </div>
              )}
            </div>
          )}

          {/* ✅ ปุ่มยืนยันเดิม: ใช้เริ่ม/จบ/เปลี่ยนแบต */}
          <button
            className={`mt-6 bg-white text-green-800 font-medium text-sm px-8 py-2 rounded-full shadow-md hover:bg-green-50 transition ${
              working ? "opacity-70 cursor-not-allowed" : ""
            }`}
            onClick={() => {
              if (working) return;

              // ✅ ถ้าเริ่มแล้ว -> ไม่ให้กด "ยืนยัน" ไปเริ่มซ้ำ
              if (step === 1 && isOnGoing) return;

              if (step === 1) {
                setShowStartConfirm(true);
              } else if (step === 2) {
                setShowEndConfirm(true);
              } else if (step === 3) {
                setShowBatteryConfirm(true);
              }
            }}
            disabled={working}
          >
            {working ? "กำลังดำเนินการ..." : "ยืนยัน"}
          </button>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="bg-orange-500 text-white px-5 py-2 rounded-full shadow-md hover:bg-orange-600 transition"
        >
          ยกเลิก
        </button>
      </div>

      {showStartConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6 pb-16">
          <div className="bg-white p-6 rounded-3xl shadow-md text-center w-full max-w-xs">
            <p className="text-lg font-semibold mb-4">คุณยืนยันจะเริ่มรอบใช่หรือไม่?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowStartConfirm(false)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
              >
                ไม่
              </button>
              <button
                onClick={async () => {
                  setShowStartConfirm(false);
                  await handleNextStep();
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
              >
                ใช่
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6 pb-16">
          <div className="bg-white p-6 rounded-3xl shadow-md text-center w-full max-w-xs">
            <p className="text-lg font-semibold mb-4">คุณต้องการจบการเล่นกอล์ฟใช่หรือไม่?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
              >
                ไม่
              </button>
              <button
                onClick={async () => {
                  setShowEndConfirm(false);
                  await handleNextStep();
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
              >
                ใช่
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatteryConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6 pb-16">
          <div className="bg-white p-6 rounded-3xl shadow-md text-center w-full max-w-xs">
            <p className="text-lg font-semibold mb-4">ยืนยันว่าเปลี่ยนแบตรถกอล์ฟสำเร็จ?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowBatteryConfirm(false)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
              >
                ไม่
              </button>
              <button
                onClick={async () => {
                  setShowBatteryConfirm(false);
                  await handleNextStep();
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
              >
                ใช่
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-3xl shadow-md text-center w-[80%] max-w-xs">
            <p className="text-lg font-semibold mb-4">คุณแน่ใจหรือไม่?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  navigate("/caddy");
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
              >
                ตกลง
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessGolfPage;
