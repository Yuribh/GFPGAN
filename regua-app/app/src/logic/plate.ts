// Brazilian plates: old format ABC1234 and Mercosul ABC1D23. Shared by the app and the plate-lookup function.

/** "abc-1d23 " -> "ABC1D23"; null when it is not a valid plate. */
export function normalizePlate(input: string): string | null {
  const p = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p) ? p : null;
}

/** For display: old plates get the dash ("ABC-1234"), Mercosul plates do not ("ABC1D23"). */
export function formatPlate(plate: string): string {
  return /^[A-Z]{3}[0-9]{4}$/.test(plate) ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}

/** Live mask for the text field: uppercase, letters/digits only, at most 7 characters. */
export function maskPlateInput(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}
