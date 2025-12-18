import React, { useState } from "react";
import ItemService from "../../service/itemService";

const ItemCard = ({ title, image, type }) => {
  const [itemId, setItemId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleCreate = async () => {
    if (!itemId) {
      setMessage("กรุณากรอกหมายเลข");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await ItemService.createItem({
        itemId,
        type, // 👈 fix type
      });

      setMessage("เพิ่มสำเร็จ");
      setItemId("");
    } catch (err) {
      setMessage(
        err?.response?.data?.message || "เกิดข้อผิดพลาด"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 w-full max-w-xs text-center">
      <img
        src={image}
        alt={title}
        className="w-full h-40 object-cover rounded-lg mb-4"
      />

      <h2 className="text-lg font-bold mb-3">{title}</h2>

      <input
        type="text"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        placeholder="หมายเลข"
        className="w-full mb-3 px-3 py-2 border rounded-lg text-center"
      />

      <button
        onClick={handleCreate}
        disabled={loading}
        className={`w-full py-2 rounded-full text-white font-semibold
          ${loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}`}
      >
        {loading ? "กำลังเพิ่ม..." : "เพิ่ม"}
      </button>

      {message && (
        <p className="mt-3 text-sm text-gray-700">{message}</p>
      )}
    </div>
  );
};

const ManageItem = () => {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <h1 className="text-2xl font-extrabold text-center mb-8">
        จัดการอุปกรณ์
      </h1>

      <div className="flex flex-col sm:flex-row gap-6 justify-center">
        <ItemCard
          title="เพิ่มรถกอล์ฟ"
          image="/images/starter/cart.jpg"
          type="car"
        />

        <ItemCard
          title="เพิ่มกระถุงกอล์ฟ"
          image="/images/starter/bag.jpg"
          type="bag"
        />
      </div>
    </div>
  );
};

export default ManageItem;
