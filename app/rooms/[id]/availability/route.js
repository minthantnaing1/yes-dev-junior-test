import pool from "@/lib/db";
import { validateBookingInput } from "@/lib/validation";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const roomId = /^\d+$/.test(id) ? Number(id) : NaN;

    const { searchParams } = new URL(req.url);
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    const validationError = validateBookingInput(roomId, checkIn, checkOut);

    if (validationError) {
      return Response.json({ message: validationError }, { status: 400 });
    }

    const roomResult = await pool.query(
      "SELECT id, name, total_units FROM rooms WHERE id = $1",
      [roomId],
    );

    const room = roomResult.rows[0];

    if (!room) {
      return Response.json({ message: "Room not found" }, { status: 404 });
    }

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
    const availableUnits = Math.max(0, room.total_units - occupied);

    return Response.json({
      roomId: room.id,
      roomName: room.name,
      checkIn,
      checkOut,
      available: availableUnits > 0,
      availableUnits,
    });
  } catch (error) {
    console.error("Availability error:", error);

    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
