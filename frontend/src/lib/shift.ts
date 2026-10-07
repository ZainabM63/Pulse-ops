export const SHIFT_START_HOUR = 8;
export const SHIFT_LENGTH_HOURS = 12;

export function getShiftRemaining(now: Date = new Date()): string {
  const shiftStart = new Date(now);
  shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
  if (now.getHours() < SHIFT_START_HOUR) shiftStart.setDate(shiftStart.getDate() - 1);
  const shiftEnd = new Date(shiftStart.getTime() + SHIFT_LENGTH_HOURS * 3600000);
  const diff = Math.max(0, shiftEnd.getTime() - now.getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}
