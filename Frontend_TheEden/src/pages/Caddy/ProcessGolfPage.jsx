import React, { useState, useEffect } from "react";
import Header from "../../components/Caddy/Header";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { useNavigate, useLocation } from "react-router-dom";
import CaddyService from "../../service/caddyService";

const ProcessGolfPage = () => {
  const [step, setStep] = useState(1);
  const [working, setWorking] = useState(false);

  // selectHole state
  const [isOnGoing, setIsOnGoing] = useState(false);
  const [currentHole, setCurrentHole] = useState(null);
  const [rounds, setRounds] = useState(0);
  const [maxMoves, setMaxMoves] = useState(9);
  const [loadingHole, setLoadingHole] = useState(false);

  // ✅ ETA / pace / slow state
  const [paceMin, setPaceMin] = useState(17);
  const [etaNext, setEtaNext] = useState(null);
  const [isSlow, setIsSlow] = useState(false);
  const [actualPrevMin, setActualPrevMin] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const { bookingId: stateBookingId } = location.state || {};
  const [bookingId, setBookingId] = useState(stateBookingId || null);

  // fallback bookingId
  useEffect(() => {
    const loadBooking = async () => {
      if (bookingId) return;
      try {
        const { data } = await CaddyService.getCaddyBookings();
        if (data?.length > 0) setBookingId(data[0]._id);
      } catch (e) {
        console.warn("โหลด bookingId ไม่ได้:", e);
      }
    };
    loadBooking();
  }, [bookingId]);

  const stepTexts = ["เริ่มออกรอบกอล์ฟ", "จบการเล่นกอล์ฟ", "เปลี่ยนแบตรถกอล์ฟ"];

  // STEP 1: start round
  const handleStartRound = async () => {
    if (!bookingId) return alert("ไม่พบ bookingId");

    try {
      setWorking(true);
      await CaddyService.startRound(bookingId);

      // ✅ reset state สำหรับรอบใหม่ในหน้าเว็บ
      setIsOnGoing(true);
      setStep(1);
      setCurrentHole(null);
      setRounds(0);
      setMaxMoves(9);
      setPaceMin(17);
      setEtaNext(null);
      setIsSlow(false);
      setActualPrevMin(null);
    } catch (err) {
      alert(err?.response?.data?.message || "เริ่มรอบไม่สำเร็จ");
    } finally {
      setWorking(false);
    }
  };

  // SELECT HOLE
  const handleSelectHole = async (holeNumber) => {
    if (loadingHole) return;
    if (!bookingId) return alert("ไม่พบ bookingId");

    // ✅ กันกดซ้ำติดกันฝั่ง UI (backend ก็กันอยู่แล้ว)
    if (currentHole === holeNumber) {
      return alert("ห้ามเลือกหลุมเดิมซ้ำติดกัน กรุณาเลือกหลุมอื่นก่อน");
    }

    try {
      setLoadingHole(true);

      const res = await CaddyService.selectHole({
        bookingId,
        holeNumber,
      });

      const d = res.data.data;

      // ✅ backend ใหม่ส่ง rounds/maxMoves/toHole
      setCurrentHole(d.toHole);
      setRounds(d.rounds);
      setMaxMoves(d.maxMoves);

      // ✅ ETA / pace / slow
      if (typeof d.pacePerHoleMin === "number") setPaceMin(d.pacePerHoleMin);
      if (d.etaNextAt) setEtaNext(new Date(d.etaNextAt));
      setIsSlow(!!d.isSlowPrevHole);
      setActualPrevMin(d.actualPrevHoleMin ?? null);

      // ✅ ครบแล้ว → ปลดล็อก Step 2
      if (d.rounds === d.maxMoves) {
        alert("ครบจำนวนครั้งแล้ว สามารถจบรอบได้");
        setStep(2);
      }
    } catch (err) {
      alert(err?.response?.data?.message || "เลือกหลุมไม่สำเร็จ");
    } finally {
      setLoadingHole(false);
    }
  };

  // STEP 2: end round
  const handleEndRound = async () => {
    try {
      setWorking(true);
      await CaddyService.endRound(bookingId);

      // ✅ จบรอบแล้ว → ไป step 3
      setStep(3);
      setIsOnGoing(false);
    } catch (err) {
      alert(err?.response?.data?.message || "จบรอบไม่สำเร็จ");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-4 py-6">
      <Header />

      {/* STEP BAR */}
      <div className="mt-6 flex justify-center">
        <div className="flex items-center gap-4">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <div
                className={`w-9 h-9 flex items-center justify-center rounded-full border-2 ${
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

      {/* STEP CONTENT */}
      <div className="mt-10 text-center">
        <h2 className="text-xl font-semibold">{stepTexts[step - 1]}</h2>

        {/* STEP 1: Start */}
        {step === 1 && !isOnGoing && (
          <button
            onClick={handleStartRound}
            disabled={working}
            className="mt-6 bg-green-600 text-white px-8 py-2 rounded-full"
          >
            {working ? "กำลังเริ่ม..." : "เริ่มออกรอบ"}
          </button>
        )}

        {/* SELECT HOLE */}
        {isOnGoing && step === 1 && (
          <div className="mt-6">
            <p className="mb-3">
              เลือกหลุม ({rounds}/{maxMoves})
            </p>

            {/* ✅ แสดง ETA / pace / ช้า */}
            <div className="mx-auto max-w-sm text-left bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-sm">
                ⏱ Pace ปัจจุบัน: <b>{paceMin}</b> นาที/หลุม
              </p>
              <p className="text-sm">
                ➡️ เวลาโดยประมาณหลุมถัดไป:{" "}
                <b>{etaNext ? etaNext.toLocaleTimeString() : "-"}</b>
              </p>
              {actualPrevMin !== null && (
                <p className="text-sm">
                  หลุมก่อนหน้าใช้เวลา: <b>{Number(actualPrevMin).toFixed(1)}</b> นาที
                </p>
              )}
              {isSlow && (
                <p className="text-sm font-semibold text-red-600 mt-1">
                  ⚠️ ช้า (หลุมก่อนหน้าเกิน 25 นาที)
                </p>
              )}
            </div>

            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: maxMoves }).map((_, i) => {
                const hole = i + 1;

                // ✅ กติกาใหม่: เลือกซ้ำได้ แต่ห้ามซ้ำติดกัน
                const disabled =
                  loadingHole ||
                  rounds >= maxMoves ||
                  currentHole === hole;

                return (
                  <button
                    key={hole}
                    disabled={disabled}
                    onClick={() => handleSelectHole(hole)}
                    className={`py-2 rounded ${
                      disabled
                        ? "bg-gray-300 text-gray-600"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                    title={currentHole === hole ? "ห้ามเลือกหลุมเดิมซ้ำติดกัน" : ""}
                  >
                    {hole}
                  </button>
                );
              })}
            </div>

            {currentHole && (
              <p className="mt-4 text-green-700">
                หลุมปัจจุบัน: {currentHole}
              </p>
            )}
          </div>
        )}

        {/* STEP 2: End */}
        {step === 2 && (
          <button
            onClick={handleEndRound}
            disabled={working}
            className="mt-6 bg-green-600 text-white px-8 py-2 rounded-full"
          >
            {working ? "กำลังจบรอบ..." : "จบการเล่นกอล์ฟ"}
          </button>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <button
            onClick={() => navigate("/caddy")}
            className="mt-6 bg-green-600 text-white px-8 py-2 rounded-full"
          >
            เสร็จสิ้น
          </button>
        )}
      </div>
    </div>
  );
};

export default ProcessGolfPage;
