// src/service/stripeService.js
import api from "./api.js";

const STRIPE_API = "/stripe";

// สร้าง Checkout Session ที่ backend และรับลิงก์ชำระเงินกลับมา
const createCheckout = (payload) => api.post(`${STRIPE_API}/create-checkout`, payload);

// ดึงข้อมูลการจองด้วย session_id (หน้า success)
const getBookingBySession = (sessionId) => api.get(`${STRIPE_API}/by-session/${sessionId}`);

// เผื่ออยากอ่าน session_id จาก URL
const getSessionIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("session_id") || params.get("sessionId") || null;
};

export default {
  createCheckout,
  getBookingBySession,
  getSessionIdFromUrl,
};
