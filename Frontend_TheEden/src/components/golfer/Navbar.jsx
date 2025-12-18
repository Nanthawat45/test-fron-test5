// src/components/Navbar.jsx
import { Link } from "react-router-dom";
import { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";      // ⬅️ ให้ตรงโปรเจกต์คุณ
import { confirmBlack, toastBlack } from "../../components/golfer/Swal";
import { CircleUser } from "lucide-react";

// แปลงรูป http -> https เพื่อกัน mixed content บนมือถือ/HTTPS
function toHttps(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch {
    // ถ้าเป็น path ในระบบ (เช่น /uploads/xxx) ก็ปล่อยไป
    return url;
  }
}

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);

  // dropdown (desktop) / mobile sheet
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // รูปโปรไฟล์ + fallback
  const [profileImg, setProfileImg] = useState("");
  useEffect(() => {
    const src = user?.img ? toHttps(user.img) : "";
    setProfileImg(src);
  }, [user?.img]);

  // กันสกรอลล์พื้นหลังตอนเปิดเมนูมือถือ
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? "hidden" : prev || "";
    return () => (document.body.style.overflow = prev || "");
  }, [mobileOpen]);

  // ปิด dropdown เมื่อคลิกข้างนอก + ปิดทุกเมนูเมื่อกด ESC
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClick(e) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  async function confirmLogout() {
    const res = await confirmBlack({
      title: "ออกจากระบบ?",
      text: "คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบตอนนี้",
      icon: "warning",
      confirmText: "ใช่, ออกจากระบบ",
      cancelText: "ยกเลิก",
      reverseButtons: true,
    });
    if (res.isConfirmed) {
      await logout();
      setDropdownOpen(false);
      setMobileOpen(false);
      await toastBlack("ออกจากระบบแล้ว", "success");
    }
  }

  const InitialAvatar = (
    <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 grid place-items-center font-en">
      {(user?.name || "?").slice(0, 1).toUpperCase()}
    </div>
  );

  const AvatarButton = (
    <button
      onClick={() => setDropdownOpen((v) => !v)}
      className="flex items-center justify-center focus:outline-none rounded-full border border-gray-200 hover:border-green-400 transition p-0.5"
      aria-haspopup="menu"
      aria-expanded={dropdownOpen}
    >
      {profileImg ? (
        <img
          src={profileImg}
          alt="Profile"
          className="w-10 h-10 rounded-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setProfileImg("")}     // ⬅️ รูปพัง → ใช้ตัวอักษรแทน
        />
      ) : (
        InitialAvatar
      )}
    </button>
  );

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur shadow-sm border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <img
            src="/images/golfer/eden-Logo.png"
            alt="The Eden Golf Club Logo"
            className="h-12 sm:h-14"
          />
        </Link>

        {/* ขวา (Desktop) */}
        <div className="hidden md:flex items-center space-x-6 relative" ref={dropdownRef}>
          {!user ? (
            <Link
              to="/register"
              className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-lg"
            >
              Join Us
            </Link>
          ) : (
            <div className="relative">
              {AvatarButton}

              {dropdownOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm text-gray-500">ยินดีต้อนรับ</p>
                    <p className="text-base font-en text-gray-800 truncate">
                      {user?.name || "ผู้ใช้"}
                    </p>
                  </div>

                  <ul className="py-1 text-gray-700">
                    <li>
                      <Link
                        to="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 hover:bg-gray-50 transition"
                      >
                        โปรไฟล์ของฉัน
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={confirmLogout}
                        className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50 transition"
                      >
                        ออกจากระบบ
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ปุ่มมือถือ (hamburger/avatar) */}
        <div className="md:hidden">
          {!user ? (
            <button
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border px-3 py-2"
              aria-label="Open menu"
            >
              ☰
            </button>
          ) : (
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center focus:outline-none rounded-full border border-gray-200 p-0.5"
              aria-label="Open menu"
            >
              {profileImg ? (
                <img
                  src={profileImg}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setProfileImg("")}
                />
              ) : (
                InitialAvatar
              )}
            </button>
          )}
        </div>
      </nav>

      {/* แผงเมนู Mobile */}
      <div
        className={`md:hidden fixed inset-0 z-40 ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        {/* backdrop */}
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileOpen(false)}
        />

        {/* sheet */}
        <div
          className={`absolute top-0 left-0 right-0 bg-white rounded-b-2xl shadow-lg border-b border-gray-200 transform transition-transform ${
            mobileOpen ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center space-x-2">
              <img src="/images/golfer/eden-Logo.png" alt="The Eden Golf Club Logo" className="h-12" />
            </Link>
            <button
              className="p-2 rounded-lg border"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          <div className="px-4 pb-4">
            {!user && (
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition text-lg"
              >
                Join Us
              </Link>
            )}

            {user && (
              <div className="mt-2">
                <div className="flex items-center gap-3 px-2 py-3">
                  {profileImg ? (
                    <img
                      src={profileImg}
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setProfileImg("")}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 grid place-items-center font-en text-lg">
                      {(user?.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">ยินดีต้อนรับ</p>
                    <p className="text-base font-medium truncate">{user?.name || "ผู้ใช้"}</p>
                  </div>
                </div>

                <nav className="mt-1 divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 bg-white active:bg-gray-50"
                  >
                    โปรไฟล์ของฉัน
                  </Link>
                  <button
                    onClick={confirmLogout}
                    className="block w-full text-left px-4 py-3 bg-white text-red-600 active:bg-gray-50"
                  >
                    ออกจากระบบ
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
