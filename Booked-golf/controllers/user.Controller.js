import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import Caddy from '../models/Caddy.js';

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  const isProd = process.env.NODE_ENV === "production";

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: isProd,                    // ✅ dev (localhost http) = false
    sameSite: isProd ? "None" : "Lax",  // ✅ dev ใช้ Lax
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });
};

export const registerByAdmin = async (req, res) => {
  const { name, phone, email, password, role } = req.body;
  const img = req.files?.[0]?.firebaseUrl || null;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      phone,
      email,
      password: hashedPassword,
      role,
      img
    });

    if (newUser && role === "caddy") {
      await Caddy.create({
        caddy_id: newUser._id,
        name: newUser.name,
        caddyStatus: "available"
      });
    }

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      phone: newUser.phone,
      email: newUser.email,
      role: newUser.role,
      img: newUser.img
    });

  } catch (error) {
    console.error("Error in registerByAdmin:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const registerUser = async (req, res) => {
  const { name, phone, email, password, role } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      phone,
      email,
      password: hashedPassword,
      role,
    });
    if (newUser) {
      if (role === "caddy") {
        await Caddy.create({
          caddy_id: newUser._id,
          name: newUser.name,
          caddyStatus: 'available'
        });
      }
    }
    if (newUser) {
      generateToken(newUser._id, res);
      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        role: newUser.role,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in registerUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      generateToken(user._id, res);
      res.json({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.log("Error in loginUser:", error);
  }
};

export const getUserProfile = async (req, res) => {
  try {
    //    .select('-password') คือคำสั่งเพื่อไม่ให้ดึงฟิลด์ password กลับมา
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.status(200).json({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        img: user.img,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllUser = async (req, res) => {
  try {
    // ค้นหาผู้ใช้ทั้งหมดและไม่รวมฟิลด์ password
    const users = await User.find({}).select('-password');

    if (users) {
      // ส่งข้อมูลผู้ใช้ทั้งหมดกลับไป
      res.status(200).json(users);
    } else {
      // กรณีไม่พบผู้ใช้ในฐานข้อมูล (ถึงแม้จะไม่น่าจะเกิดขึ้น)
      res.status(404).json({ message: "No users found" });
    }
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const logout = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0), // ตั้งค่าให้คุกกี้หมดอายุทันที
  });

  // 2. ส่ง response กลับไปให้ client
  res.status(200).json({ message: 'Logged out successfully' });
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password'); // ไม่รวม password
    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params; // ดึง id ของผู้ใช้จากพารามิเตอร์ URL
  const { name, phone, email, password, role } = req.body;
  const img = req.files?.[0]?.firebaseUrl || null;

  try {
    // 🔍 ตรวจสอบว่าผู้ใช้มีอยู่จริงไหม
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

      const previousRole = user.role;

    // 📩 ตรวจสอบว่า email ใหม่ซ้ำกับคนอื่นไหม (ยกเว้นตัวเอง)
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }
      user.email = email;
    }

    // ✏️ อัปเดตข้อมูลทั่วไป
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (role) user.role = role.toLowerCase();
    if (img) user.img = img;

    // 🔐 ถ้ามีรหัสผ่านใหม่ -> เข้ารหัสก่อน
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    // 💾 บันทึกข้อมูลใหม่
    const updatedUser = await user.save();

    // 🧩 จัดการเอกสาร Caddy ตามโรลที่เปลี่ยน
    if (previousRole === "caddy" && updatedUser.role !== "caddy") {
      // ถ้าเคยเป็น caddy แล้วเปลี่ยนเป็นโรลอื่น -> ลบออกจากโมเดล Caddy
      await Caddy.deleteOne({ caddy_id: updatedUser._id });
    } else if (updatedUser.role === "caddy") {
      // ถ้ายังเป็น/เปลี่ยนมาเป็น caddy -> อัปเดต/สร้างข้อมูล Caddy ให้สอดคล้อง
      const caddy = await Caddy.findOne({ caddy_id: updatedUser._id });
      if (caddy) {
        caddy.name = updatedUser.name;
        await caddy.save();
      } else {
        await Caddy.create({
          caddy_id: updatedUser._id,
          name: updatedUser.name,
          caddyStatus: "available",
        });
      }
    }

    res.status(200).json({
      message: "User updated successfully",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        phone: updatedUser.phone,
        email: updatedUser.email,
        role: updatedUser.role,
        img: updatedUser.img
      }
    });
  } catch (error) {
    console.error("Error in updateUserByAdmin:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllNotUser = async (req, res) => {
  try {
    // 🔍 ค้นหาผู้ใช้ทั้งหมดที่ role ไม่ใช่ 'user'
    const employees = await User.find({ role: { $ne: "user" } })
      .select("-password") // ตัดรหัสผ่านออกจากผลลัพธ์เพื่อความปลอดภัย
      .sort({ role: 1, name: 1 }); // เรียงตาม role แล้วตามชื่อ

    res.status(200).json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("Error in getAllNotUser:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching non-user accounts.",
    });
  }
};

export const getAllGolfer = async (req, res) => {
  try {
    
    const employees = await User.find({ role: "user" })
      .select("-password") 
      .sort({ role: 1, name: 1 }); 

    res.status(200).json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("Error in getAllNotUser:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching non-user accounts.",
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      await user.deleteOne();
      res.status(200).json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};


