/**
 * Personalized invitation links:
 *   ?to=Tito%20Jun&seats=2
 */
export interface GuestInvite {
  readonly name: string;
  readonly seats: number | null;
}

const MAX_NAME = 48;
const MAX_SEATS = 8;

export function readGuestInvite(search = ''): GuestInvite {
  const params = new URLSearchParams(search);
  let name = (params.get('to') ?? '').trim().replace(/\s+/g, ' ');
  if (name.length > MAX_NAME) {
    name = name.slice(0, MAX_NAME).trim();
  }

  const seatsRaw = Number.parseInt(params.get('seats') ?? '', 10);
  const seats =
    Number.isInteger(seatsRaw) && seatsRaw >= 1 && seatsRaw <= MAX_SEATS
      ? seatsRaw
      : null;

  return { name, seats };
}
