export function calculatePrice(
  room,
  occupied,
  completedStays,
  checkIn,
  checkOut,
) {
  const checkInDate = new Date(`${checkIn}T00:00:00Z`);
  const checkOutDate = new Date(`${checkOut}T00:00:00Z`);

  const nights = (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24);

  const remainingUnits = room.total_units - occupied;

  let pricePerNight = Number(room.base_price_per_night);

  // Apply 20% surcharge if only one room remains
  const hasSurcharge = remainingUnits === 1;

  if (hasSurcharge) {
    pricePerNight *= 1.2;
  }

  // Apply 10% loyalty discount for 4+ completed stays
  const hasLoyaltyDiscount = completedStays >= 4;

  if (hasLoyaltyDiscount) {
    pricePerNight *= 0.9;
  }

  const totalPrice = Math.round(pricePerNight * nights * 100) / 100;

  return {
    nights,
    pricePerNight,
    totalPrice,
    hasSurcharge,
    hasLoyaltyDiscount,
  };
}
