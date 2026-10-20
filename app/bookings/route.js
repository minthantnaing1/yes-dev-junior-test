import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { validateBookingInput } from "@/lib/validation";
import { calculatePrice } from "@/lib/pricing";

export async function POST(req) {
  let client;

  try {
    // 1. Authenticate user
    const decoded = verifyToken(req);

    if (!decoded || !Number.isInteger(decoded.userId)) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 2. Read request body
    const { roomId, checkIn, checkOut } = await req.json();

    // 3. Validate booking input
    const validationError = validateBookingInput(roomId, checkIn, checkOut);

    if (validationError) {
      return Response.json({ message: validationError }, { status: 400 });
    }

    // 4. Start database transaction
    client = await pool.connect();
    await client.query("BEGIN");

    // 5. Lock room row to prevent concurrent double-booking
    const roomResult = await client.query(
      "SELECT * FROM rooms WHERE id = $1 FOR UPDATE",
      [roomId],
    );

    const room = roomResult.rows[0];

    if (!room) {
      await client.query("ROLLBACK");

      return Response.json({ message: "Room not found" }, { status: 404 });
    }

    // 6. Check overlapping confirmed bookings
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

    // 7. Reject if no units remain
    if (occupied >= room.total_units) {
      await client.query("ROLLBACK");

      return Response.json(
        { message: "Room is not available" },
        { status: 409 },
      );
    }

    // 8. Get user's completed stays
    const userResult = await client.query(
      "SELECT completed_stays FROM users WHERE id = $1",
      [decoded.userId],
    );

    const bookingUser = userResult.rows[0];

    if (!bookingUser) {
      await client.query("ROLLBACK");

      return Response.json({ message: "User not found" }, { status: 401 });
    }

    // 9. Calculate price using shared helper
    const pricing = calculatePrice(
      room,
      occupied,
      bookingUser.completed_stays,
      checkIn,
      checkOut,
    );

    // 10. Insert confirmed booking
    const bookingResult = await client.query(
      `INSERT INTO bookings
         (user_id, room_id, check_in, check_out, total_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [decoded.userId, roomId, checkIn, checkOut, pricing.totalPrice],
    );

    // 11. Commit transaction
    await client.query("COMMIT");

    return Response.json(
      {
        message: "Booking created successfully",
        booking: bookingResult.rows[0],
      },
      { status: 201 },
    );
  } catch (error) {
    // Roll back if a database operation failed
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    console.error("Booking error:", error);

    // PostgreSQL overlapping booking constraint
    if (error.code === "23P01") {
      return Response.json(
        { message: "Room is not available" },
        { status: 409 },
      );
    }

    // Invalid JSON body
    if (error instanceof SyntaxError) {
      return Response.json(
        { message: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    return Response.json({ message: "Internal Server Error" }, { status: 500 });
  } finally {
    // Always release database connection
    if (client) {
      client.release();
    }
  }
}
