// Shared by the React app (local demo mode) and the Vercel API routes.

export const CAPACITY = 4; // seats in one shared cab
export const WINDOW_MIN = 30; // riders landing within +/- 30 min can share

// Solo (full cab) fare in INR from Mumbai airport (BOM)
export const DESTINATIONS = [
  { name: 'Andheri', solo: 500 },
  { name: 'Powai', solo: 800 },
  { name: 'Dadar', solo: 700 },
  { name: 'Borivali', solo: 900 },
  { name: 'Thane', solo: 1000 },
  { name: 'Navi Mumbai (Vashi)', solo: 1100 },
  { name: 'Dombivli', solo: 1500 },
];

// Share of the solo fare each rider pays, by number of riders in the cab.
// 4 riders to Thane: 1000 * 0.3 = Rs 300 each (the example from the brief).
export const FACTORS = { 1: 1, 2: 0.6, 3: 0.4, 4: 0.3 };

export const soloFare = (destination) =>
  DESTINATIONS.find((d) => d.name === destination)?.solo ?? null;

// Round up to the nearest Rs 10
export const farePerRider = (solo, riders) =>
  Math.ceil((solo * FACTORS[Math.min(Math.max(riders, 1), CAPACITY)]) / 10) * 10;

export function describePool({ id, destination, arrival, taken }) {
  const solo = soloFare(destination);
  return {
    id,
    destination,
    arrival,
    taken,
    seatsLeft: CAPACITY - taken,
    solo,
    perRider: farePerRider(solo, taken),
    full: taken >= CAPACITY,
  };
}

export function validateBooking(b) {
  const errors = [];
  if (!b?.name || b.name.trim().length < 2) errors.push('Enter your name');
  if (!/^\+?[0-9]{10,13}$/.test((b?.phone || '').replace(/\s|-/g, ''))) errors.push('Enter a valid phone number');
  if (!b?.flightNo || b.flightNo.trim().length < 3) errors.push('Enter your flight number');
  if (!b?.arrival || Number.isNaN(new Date(b.arrival).getTime())) errors.push('Enter your landing time');
  if (soloFare(b?.destination) == null) errors.push('Choose a destination');
  return errors;
}
