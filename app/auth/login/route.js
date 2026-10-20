import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "@/lib/db";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return Response.json(
        { message: "Email and password are required" },
        { status: 400 },
      );
    }

    const result = await pool.query(
      "SELECT id, email, name, password_hash, completed_stays FROM users WHERE email = $1",
      [email.trim()],
    );

    const user = result.rows[0];

    if (!user) {
      return Response.json(
        {
          message: "invalid email or password",
        },
        { status: 401 },
      );
    }

    const valid_password = await bcrypt.compare(password, user.password_hash);

    if (!valid_password) {
      return Response.json(
        {
          message: "Invalid email or password",
        },
        { status: 401 },
      );
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    return Response.json(
      {
        message: "Login Successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.log("login error", error);

    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
