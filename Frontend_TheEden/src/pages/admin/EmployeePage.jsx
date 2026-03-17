// EmployeePage.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import EmployeeCard from "../../components/admin/EmployeeCard";
import UserService from "../../service/userService";

// ⭐️ Roles ทั้งหมด
const roles = ["All", "Admin", "Caddy", "Starter", "User"];


export default function EmployeePage() {
    const { employees, loading } = useOutletContext();
    const navigate = useNavigate();

    // ⭐️ User (แทน Golfer)
    const [users, setUsers] = useState([]);
    const [userLoading, setUserLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("All");

    // ⭐️ โหลด User ทั้งหมด
useEffect(() => {
    const fetchUsers = async () => {
        try {
            const res = await UserService.getAllGolfer();

            console.log("getAllGolfer res.data =", res.data);

            // ✅ จุดที่ถูกต้อง
            const rawUsers = res.data.employees || [];

            const normalizedUsers = rawUsers.map((user) => ({
                ...user,
                role: "User", // normalize ให้ตรง Tab
                name: user.name || "ไม่ระบุชื่อ",
            }));

            setUsers(normalizedUsers);
        } catch (error) {
            console.error("โหลดข้อมูล User ไม่สำเร็จ", error);
        } finally {
            setUserLoading(false);
        }
    };

    fetchUsers();
}, []);



    // ⭐️ รวม employees + users
    const allEmployees = useMemo(() => {
        return [...employees, ...users];
    }, [employees, users]);

    // ⭐️ นับ Role
    const roleCounts = useMemo(() => {
        const counts = { All: allEmployees.length };

        allEmployees.forEach((emp) => {
            const role = emp.role || "N/A";
            if (roles.includes(role)) {
                counts[role] = (counts[role] || 0) + 1;
            }
        });

        roles.slice(1).forEach((role) => {
            if (counts[role] === undefined) {
                counts[role] = 0;
            }
        });

        return counts;
    }, [allEmployees]);

    // ⭐️ Filter
    const filteredEmployees = useMemo(() => {
        return allEmployees.filter((emp) => {
            const role = emp.role || "N/A";
            const matchesTab = activeTab === "All" || role === activeTab;
            const matchesSearch = emp.name
                .toLowerCase()
                .includes(searchTerm.toLowerCase());

            return matchesTab && matchesSearch;
        });
    }, [allEmployees, activeTab, searchTerm]);

    // ⭐️ click
    const handleEmployeeClick = (emp) => {
    if (emp.role === "User") {
        navigate(`/admin/user/${emp._id}`);
    } else {
        navigate(`/admin/detail/${emp._id}`);
    }
    };


    if (loading || userLoading) {
        return (
            <div className="text-center p-8 text-xl text-gray-600">
                กำลังโหลดข้อมูลทั้งหมด...
            </div>
        );
    }

    return (
        <div className="p-4 bg-white rounded-xl shadow-lg">
            {/* Search */}
            <div className="mb-6 flex justify-end">
                <input
                    type="text"
                    placeholder="ค้นหาชื่อ..."
                    className="p-2 border rounded-lg w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Tabs */}
            <div className="flex border-b mb-6">
                {roles.map((role) => (
                    <div
                        key={role}
                        className={`px-4 py-2 cursor-pointer font-semibold
                            ${
                                activeTab === role
                                    ? "border-b-4 border-green-500 text-green-600"
                                    : "text-gray-500"
                            }`}
                        onClick={() => setActiveTab(role)}
                    >
                        {role}
                        <span className="ml-2 text-xs bg-gray-200 px-2 rounded-full">
                            {roleCounts[role]}
                        </span>
                    </div>
                ))}
            </div>

            {/* Cards */}
            {filteredEmployees.length === 0 ? (
                <div className="text-center text-gray-500 p-10">
                    ไม่พบข้อมูล
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredEmployees.map((emp) => (
                        <EmployeeCard
                            key={emp._id}
                            employee={emp}
                            onClick={() => handleEmployeeClick(emp)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}