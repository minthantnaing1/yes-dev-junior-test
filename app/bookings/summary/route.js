import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function GET(req) {
  try {
    // 1. Verify JWT
    const decoded = verifyToken(req);

    if (!decoded || !Number.isInteger(decoded.userId)) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 2. Calculate booking statistics
    const result = await pool.query(
      `SELECT
     COUNT(*) FILTER (WHERE status = 'confirmed')::int
       AS successful_bookings,

     COUNT(*) FILTER (WHERE status = 'rejected')::int
       AS rejected_bookings,

     COUNT(*) FILTER (WHERE status = 'cancelled')::int
       AS cancelled_bookings,

     COALESCE(
       SUM(total_price) FILTER (WHERE status = 'confirmed'),
       0
     ) AS total_revenue
   FROM bookings`,
    );

    const summary = result.rows[0];

    return Response.json({
      successfulBookings: summary.successful_bookings,
      rejectedBookings: summary.rejected_bookings,
      cancelledBookings: summary.cancelled_bookings,
      totalRevenue: Number(summary.total_revenue),
      currency: "THB",
    });
  } catch (error) {
    console.error("Booking summary error:", error);

    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
