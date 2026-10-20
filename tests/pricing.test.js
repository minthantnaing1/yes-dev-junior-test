import { describe, it, expect } from "vitest";
import { calculatePrice } from "../lib/pricing";

describe("Booking Pricing", () => {
  const room = {
    base_price_per_night: 20000,
    total_units: 1,
  };

  it("applies 20% surcharge for the last available room", () => {
    const result = calculatePrice(room, 0, 0, "2027-05-10", "2027-05-11");

    expect(result.pricePerNight).toBe(24000);
    expect(result.totalPrice).toBe(24000);
    expect(result.hasSurcharge).toBe(true);
    expect(result.hasLoyaltyDiscount).toBe(false);
  });

  it("applies 10% loyalty discount for 4 completed stays", () => {
    const result = calculatePrice(room, 0, 4, "2027-05-10", "2027-05-11");

    expect(result.pricePerNight).toBe(21600);
    expect(result.totalPrice).toBe(21600);
    expect(result.hasSurcharge).toBe(true);
    expect(result.hasLoyaltyDiscount).toBe(true);
  });

  it("does not apply loyalty discount for 3 completed stays", () => {
    const result = calculatePrice(room, 0, 3, "2027-05-10", "2027-05-11");

    expect(result.pricePerNight).toBe(24000);
    expect(result.hasLoyaltyDiscount).toBe(false);
  });

  it("calculates the correct total for multiple nights", () => {
    const result = calculatePrice(room, 0, 4, "2027-05-10", "2027-05-13");

    expect(result.nights).toBe(3);
    expect(result.totalPrice).toBe(64800);
  });

  it("does not apply surcharge when more than one unit remains", () => {
    const multipleUnitRoom = {
      base_price_per_night: 20000,
      total_units: 3,
    };

    const result = calculatePrice(
      multipleUnitRoom,
      0,
      0,
      "2027-05-10",
      "2027-05-11",
    );

    expect(result.pricePerNight).toBe(20000);
    expect(result.hasSurcharge).toBe(false);
  });

  it("applies surcharge before loyalty discount", () => {
    const result = calculatePrice(room, 0, 4, "2027-05-10", "2027-05-12");

    expect(result.pricePerNight).toBe(21600);
    expect(result.totalPrice).toBe(43200);
  });
});
