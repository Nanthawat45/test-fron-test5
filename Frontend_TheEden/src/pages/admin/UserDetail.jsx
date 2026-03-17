// pages/admin/UserDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import UserService from "../../service/userService";

export default function UserDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await UserService.getUserById(id);
                setUser(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [id]);

    if (loading) return <div className="p-6">กำลังโหลด...</div>;
    if (!user) return <div className="p-6">ไม่พบข้อมูลผู้ใช้</div>;

    return (
        <div className="p-6 bg-white rounded-xl shadow">
            <h1 className="text-2xl font-bold mb-4">ข้อมูลผู้ใช้</h1>

            <div className="space-y-2">
                <p><b>ชื่อ:</b> {user.name}</p>
                <p><b>Email:</b> {user.email}</p>
                <p><b>เบอร์:</b> {user.phone}</p>
                <p><b>Role:</b> {user.role}</p>
            </div>

            <button
                onClick={() => navigate(-1)}
                className="mt-6 px-4 py-2 bg-gray-200 rounded"
            >
                กลับ
            </button>
        </div>
    );
}