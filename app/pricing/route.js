import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { validateBookingInput } from "@/lib/validation";
import { calculatePrice } from "@/lib/pricing";

export async function GET(req) {
  try {
    // Authenticate user
    const decoded = verifyToken(req);

    if (!decoded || !Number.isInteger(decoded.userId)) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Read query parameters
    const { searchParams } = new URL(req.url);

    const roomIdParam = searchParams.get("roomId");
    const roomId =
      roomIdParam && /^\d+$/.test(roomIdParam) ? Number(roomIdParam) : NaN;

    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    // Validate inputs
    const validationError = validateBookingInput(roomId, checkIn, checkOut);

    if (validationError) {
      return Response.json({ message: validationError }, { status: 400 });
    }

    // Get room details
    const roomResult = await pool.query("SELECT * FROM rooms WHERE id = $1", [
      roomId,
    ]);

    const room = roomResult.rows[0];

    if (!room) {
      return Response.json({ message: "Room not found" }, { status: 404 });
    }

    // Get user loyalty information
    const userResult = await pool.query(
      "SELECT completed_stays FROM users WHERE id = $1",
      [decoded.userId],
    );

    const user = userResult.rows[0];

    if (!user) {
      return Response.json({ message: "User not found" }, { status: 401 });
    }

    // Count overlapping bookings
    const overlapResult = await pool.query(
      `SELECT COUNT(*)::int AS occupied
       FROM bookings
       WHERE room_id = $1
         AND status = 'confirmed'
         AND check_in < $3::date
         AND check_out > $2::date`,
      [roomId, checkIn, checkOut],
    );

    const occupied = overlapResult.rows[0].occupied;
    const remainingUnits = room.total_units - occupied;

    if (remainingUnits <= 0) {
      return Response.json(
        { message: "Room is not available" },
        { status: 409 },
      );
    }

    // Calculate price
    const pricing = calculatePrice(
      room,
      occupied,
      user.completed_stays,
      checkIn,
      checkOut,
    );

    // Return price without creating a booking
    return Response.json({
      roomId,
      checkIn,
      checkOut,
      currency: "THB",
      ...pricing,
    });
  } catch (error) {
    console.error("Pricing error:", error);

    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
