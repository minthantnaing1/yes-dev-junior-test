import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { validateBookingInput } from "@/lib/validation";
import { calculatePrice } from "@/lib/pricing";

export async function POST(req) {
  let client;

  try {
    const decoded = verifyToken(req);

    if (!decoded || !Number.isInteger(decoded.userId)) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { roomId, checkIn, checkOut } = await req.json();

    const validationError = validateBookingInput(roomId, checkIn, checkOut);

    if (validationError) {
      return Response.json({ message: validationError }, { status: 400 });
    }

    // Start transaction
    client = await pool.connect();
    await client.query("BEGIN");

    // Lock room row
    const roomResult = await client.query(
      "SELECT * FROM rooms WHERE id = $1 FOR UPDATE",
      [roomId],
    );

    const room = roomResult.rows[0];

    if (!room) {
      await client.query("ROLLBACK");

      return Response.json({ message: "Room not found" }, { status: 404 });
    }

    // Check overlapping confirmed bookings
    const overlapResult = await client.query(
      `SELECT COUNT(*)::int AS occupied
       FROM bookings
       WHERE room_id = $1
         AND status = 'confirmed'
         AND check_in < $3::date
         AND check_out > $2::date`,
      [roomId, checkIn, checkOut],
    );

    const occupied = overlapResult.rows[0].occupied;

    if (occupied >= room.total_units) {
      await client.query("ROLLBACK");

      await pool.query(
        `INSERT INTO bookings
       (user_id, room_id, check_in, check_out, status, total_price)
     VALUES ($1, $2, $3, $4, 'rejected', 0)`,
        [decoded.userId, roomId, checkIn, checkOut],
      );

      return Response.json(
        { message: "Room is not available" },
        { status: 409 },
      );
    }

    // Get loyalty information from database
    const userResult = await client.query(
      "SELECT completed_stays FROM users WHERE id = $1",
      [decoded.userId],
    );

    const bookingUser = userResult.rows[0];

    if (!bookingUser) {
      await client.query("ROLLBACK");

      return Response.json({ message: "User not found" }, { status: 401 });
    }

    // Calculate total price
    const pricing = calculatePrice(
      room,
      occupied,
      bookingUser.completed_stays,
      checkIn,
      checkOut,
    );

    const totalPrice = pricing.totalPrice;

    // Insert booking
    const bookingResult = await client.query(
      `INSERT INTO bookings
         (user_id, room_id, check_in, check_out, total_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [decoded.userId, roomId, checkIn, checkOut, totalPrice],
    );

    // Commit transaction
    await client.query("COMMIT");

    return Response.json(
      {
        message: "Booking created successfully",
        booking: bookingResult.rows[0],
      },
      { status: 201 },
    );
  } catch (error) {
    // 13. Roll back on error
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    console.error("Booking error:", error);

    // PostgreSQL exclusion constraint violation
    if (error.code === "23P01") {
      return Response.json(
        { message: "Room is not available" },
        { status: 409 },
      );
    }

    // Invalid JSON
    if (error instanceof SyntaxError) {
      return Response.json(
        { message: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
