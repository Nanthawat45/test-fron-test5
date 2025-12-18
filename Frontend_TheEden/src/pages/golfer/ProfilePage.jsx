import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserService from "../../service/userService";
import BookingService from "../../service/bookingService";
import { useAuthContext } from "../../context/AuthContext";
import { isStaffRole } from "../auth/roles";

const body = (res) => res?.data ?? res;
const pickBookings = (res) => {
  const d = body(res);
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.bookings)) return d.bookings;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.data?.bookings)) return d.data.bookings;
  if (d?.booking && !Array.isArray(d.booking)) return [d.booking];
  if (d?.data?.booking && !Array.isArray(d.data.booking)) return [d.data.booking];
  if (Array.isArray(d?.list)) return d.list;
  if (Array.isArray(d?.items)) return d.items;
  return [];
};

/* ----------------- helpers: format + sort ----------------- */
const currency = (n) => `฿${Number(n || 0).toLocaleString()}`;
const dateTh = (d) => (d ? new Date(d).toLocaleDateString("th-TH") : "-");

// แปลง HH:MM เป็นนาทีเพื่อเรียง
function timeToMinutes(t = "") {
  const m = /^(\d{2}):(\d{2})$/.exec(String(t));
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

// ดึง timestamp จาก ObjectId ของ Mongo (ถ้าไม่มี createdAt/updatedAt)
function tsFromObjectId(id = "") {
  if (typeof id !== "string" || id.length < 8) return 0;
  const sec = parseInt(id.substring(0, 8), 16);
  return Number.isFinite(sec) ? sec * 1000 : 0;
}

// ตัวจัดเรียงหลัก: ใหม่สุดอยู่บนสุดเสมอ
function sortByNewest(list = []) {
  return [...list].sort((a, b) => {
    const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (bCreated !== aCreated) return bCreated - aCreated;

    const aUpdated = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bUpdated = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (bUpdated !== aUpdated) return bUpdated - aUpdated;

    const ad = a?.date ? new Date(a.date).getTime() : 0;
    const bd = b?.date ? new Date(b.date).getTime() : 0;
    if (bd !== ad) return bd - ad;

    const at = timeToMinutes(a?.timeSlot);
    const bt = timeToMinutes(b?.timeSlot);
    if (bt !== at) return bt - at;

    const ao = tsFromObjectId(a?._id);
    const bo = tsFromObjectId(b?._id);
    if (bo !== ao) return bo - ao;

    return 0;
  });
}

export default function ProfilePage() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [bookings, setBookings] = useState([]);

  // ✅ แยกสถานะโหลด: โปรไฟล์ vs การจอง
  const [fetchingMe, setFetchingMe] = useState(true);
  const [fetchingBookings, setFetchingBookings] = useState(true);

  const [error, setError] = useState("");

  // upload states
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // redirect staff ไปโปรไฟล์ตามบทบาท (เหมือนเดิม)
  useEffect(() => {
    if (loading) return;
    if (user && isStaffRole(user.role)) {
      const r = String(user.role || "").toLowerCase();
      if (r === "admin") navigate("/admin/profile", { replace: true });
      else if (r === "starter") navigate("/starter/profile", { replace: true });
      else if (r === "caddy") navigate("/caddy/profile", { replace: true });
    }
  }, [user, loading, navigate]);

  // ✅ โหลดโปรไฟล์ก่อน แล้วให้เรนเดอร์ UI ได้ทันที
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    let alive = true;
    (async () => {
      try {
        setError("");
        setFetchingMe(true);

        const profRes = await UserService.getUserProfile();
        const meData = body(profRes);
        if (alive) setMe(meData);
      } catch (e) {
        if (alive) {
          const msg = e?.response?.data?.message || e?.message || "โหลดโปรไฟล์ไม่สำเร็จ";
          setError(String(msg));
        }
      } finally {
        if (alive) setFetchingMe(false);
      }
    })();

    return () => { alive = false; };
  }, [loading, user, navigate]);

  // ✅ โหลดการจอง แยก effect ต่างหาก (ช้า/ว่าง/พังก็ไม่บังหน้าโปรไฟล์)
  useEffect(() => {
    if (loading || !user) return;

    let disposed = false;
    (async () => {
      try {
        setFetchingBookings(true);
        const myBookRes = await BookingService.getMyBookings();
        const list = sortByNewest(pickBookings(myBookRes));
        if (!disposed) setBookings(list);
      // eslint-disable-next-line no-empty
      } catch {
        // ไม่ตั้ง error กลาง เพื่อไม่ให้บังหน้าโปรไฟล์
      } finally {
        if (!disposed) setFetchingBookings(false);
      }
    })();

    return () => { disposed = true; };
  }, [loading, user]);

  // รีเฟรชการจองเมื่อกลับมาโฟกัสแท็บ (เหมือนเดิม)
  useEffect(() => {
    if (!user) return;
    let disposed = false;

    const refetch = async () => {
      if (disposed) return;
      try {
        const myBookRes = await BookingService.getMyBookings();
        const list = sortByNewest(pickBookings(myBookRes));
        if (!disposed) setBookings(list);
      // eslint-disable-next-line no-empty
      } catch {}
    };

    const onFocus = () => {
      if (document.visibilityState === "visible") refetch();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user]);

  // เลือกรูป + ตรวจ + preview (เหมือนเดิม)
  function onPickFile(e) {
    setUploadError("");
    const f = e.target.files?.[0];
    if (!f) { clearPicked(); return; }
    const okTypes = ["image/jpeg","image/jpg","image/png","image/gif","image/webp"];
    if (!okTypes.includes(f.type)) { setUploadError("รองรับเฉพาะ JPG/PNG/GIF/WEBP"); return; }
    if (f.size > 1 * 1024 * 1024) { setUploadError("ขนาดไฟล์ไม่เกิน 1 MB"); return; }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }
  function clearPicked() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setFile(null);
  }
  async function onSavePhoto() {
    if (!file || !me?._id) return;
    try {
      setSaving(true);
      setUploadError("");
      const form = new FormData();
      form.append("img", file);
      const res = await UserService.updateUser(me._id, form);
      const updated = body(res);
      setMe((prev) => ({ ...prev, ...(updated?.user ?? updated) }));
      clearPicked();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "อัปเดตรูปไม่สำเร็จ";
      setUploadError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  // ⬇️ แสดง loader เฉพาะตอน “ยังไม่รู้ me เลย”
  const showInitialLoader = loading || (fetchingMe && !me);
  if (showInitialLoader) {
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-50">
        <p className="text-neutral-500">กำลังโหลดข้อมูล…</p>
      </div>
    );
  }

  if (error && !me) {
    return (
      <CenteredCard>
        <p className="text-red-600 text-center">{error}</p>
        <div className="mt-4 text-center">
          <Link to="/login" className="text-emerald-700 underline">ไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </CenteredCard>
    );
  }

  if (!me) {
    return (
      <CenteredCard>
        <p className="text-red-600 text-center">ไม่พบข้อมูลผู้ใช้</p>
        <div className="mt-4 text-center">
          <Link to="/" className="text-emerald-700 underline">กลับหน้าหลัก</Link>
        </div>
      </CenteredCard>
    );
  }

  // ✅ จากนี้ไป “โปรไฟล์จะแสดงเสมอ” แม้ bookings จะยังโหลด/ว่าง/พัง
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-neutral-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-en tracking-tight text-neutral-900">Profile</h1>
          <Link to="/" className="rounded-full px-4 py-2 text-sm font-th bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition">
            กลับหน้าหลัก
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[1.05fr_1fr]">
          {/* Summary + Upload */}
          <section className="bg-white/70 backdrop-blur rounded-3xl shadow-sm ring-1 ring-black/5 p-6 md:p-8">
            <div className="flex items-center gap-6">
              {previewUrl || me.img ? (
                <img src={previewUrl || me.img} alt={me.name || "avatar"} className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover ring-2 ring-emerald-200" />
              ) : (
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-neutral-100 text-neutral-700 grid place-items-center text-3xl font-en ring-2 ring-neutral-200">
                  {(me.name || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-2xl font-en text-neutral-900 truncate">{me.name}</p>
                <p className="text-neutral-600 truncate">{me.email}</p>
                {me.phone && <p className="text-neutral-600">โทร: {me.phone}</p>}
                <span className="mt-3 inline-block px-3 py-1 text-xs rounded-full bg-neutral-100 text-neutral-700">บทบาท: {me.role || "-"}</span>
              </div>
            </div>

            <div className="mt-8">
              <label className="block text-sm text-neutral-700 mb-2">เปลี่ยนรูปโปรไฟล์</label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer text-neutral-800 bg-neutral-50 hover:bg-neutral-100 ring-1 ring-neutral-200 transition">
                  เลือกรูปภาพ
                  <input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
                </label>
                {file && (
                  <>
                    <button onClick={onSavePhoto} disabled={saving} className="px-3 py-1.5 rounded-full text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition">
                      {saving ? "กำลังบันทึก…" : "บันทึกรูป"}
                    </button>
                    <button type="button" onClick={clearPicked} className="px-3 py-1.5 rounded-full text-sm font-medium text-neutral-700 hover:text-neutral-900 bg-transparent hover:bg-neutral-100 ring-1 ring-transparent hover:ring-neutral-200 transition">
                      ยกเลิก
                    </button>
                  </>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-2">รองรับไฟล์: JPG, PNG, GIF, WEBP • สูงสุด 1 MB</p>
              {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CopyField label="รหัสผู้ใช้" value={me._id} />
              <CopyField label="อีเมล" value={me.email} />
            </div>
          </section>

          {/* Bookings */}
          <section className="bg-white/70 backdrop-blur rounded-3xl shadow-sm ring-1 ring-black/5 p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">การจองของฉัน</h2>
              <Link to="/booking" className="rounded-full px-4 py-2 text-sm font-th bg-emerald-600 text-white hover:bg-emerald-700 transition">
                จองรอบใหม่
              </Link>
            </div>

            {/* 🔄 แสดงสถานะโหลดของ "การจอง" แยกออกจากโปรไฟล์ */}
            {fetchingBookings ? (
              <div className="text-neutral-600">กำลังโหลดรายการจอง…</div>
            ) : bookings.length === 0 ? (
              <div className="text-neutral-600">ยังไม่มีรายการจอง</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto pr-1">
                <ul className="space-y-3">
                  {bookings.map((b) => (
                    <li key={b._id} className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300 hover:shadow-sm transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-en text-neutral-900 truncate">
                            {dateTh(b.date)} • {b.timeSlot}
                          </p>
                          <p className="text-sm text-neutral-600">
                            {b.courseType} หลุม • ผู้เล่น {b.players} • สถานะ {b.status}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-th text-neutral-900">{currency(b.totalPrice)}</p>
                          {b.isPaid ? (
                            <span className="text-emerald-700 text-xs">ชำระแล้ว</span>
                          ) : (
                            <span className="text-orange-600 text-xs">ยังไม่ชำระ</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/* ---------- Small UI helpers ---------- */
function CenteredCard({ children }) {
  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50">
      <div className="max-w-md w-full bg-white/70 backdrop-blur rounded-2xl shadow ring-1 ring-black/5 p-6">
        {children}
      </div>
    </div>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    // eslint-disable-next-line no-empty
    } catch {}
  }
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-sm text-neutral-900 truncate">{value || "-"}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-th bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition"
      >
        {copied ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
    </div>
  );
}