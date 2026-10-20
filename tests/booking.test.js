import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("Booking API", () => {
  it("returns 409 when booking dates overlap", async () => {
    // 1. Log in with a seed user
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "new.guest@example.com",
        password: "Passw0rd!",
      }),
    });

    expect(loginResponse.status).toBe(200);

    const loginData = await loginResponse.json();
    const token = loginData.token;

    expect(token).toBeTruthy();

    // 2. Book a future date range
    const bookingBody = {
      roomId: 1,
      checkIn: "2027-09-10",
      checkOut: "2027-09-12",
    };

    const firstResponse = await fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bookingBody),
    });

    // First booking succeeds, or already exists from a previous test run
    expect([201, 409]).toContain(firstResponse.status);

    // 3. Attempt an overlapping booking
    const overlappingResponse = await fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        roomId: 1,
        checkIn: "2027-09-11",
        checkOut: "2027-09-13",
      }),
    });

    // 4. Must reject the overlapping request
    expect(overlappingResponse.status).toBe(409);
  });
});
