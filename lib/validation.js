export function isValidDate(value) {
  if (typeof value !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateBookingInput(roomId, checkIn, checkOut) {
  // Validate room ID
  if (!Number.isInteger(roomId) || roomId <= 0) {
    return "Invalid room ID";
  }

  // Validate dates
  if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
    return "Invalid date format. Use YYYY-MM-DD";
  }

  // Check date order
  if (checkOut <= checkIn) {
    return "Check-out must be after check-in";
  }

  // Get today's date in Bangkok
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Reject past dates
  if (checkIn < today) {
    return "Check-in date cannot be in the past";
  }

  // No validation errors
  return null;
}
