const ATTENDANCE_QR_PAYLOAD_PATTERN = /^TANDAIU-ATTENDANCE:1:([A-Za-z0-9_-]{43})$/;

export function parseAttendanceQrPayload(payload: string): string | null {
  return ATTENDANCE_QR_PAYLOAD_PATTERN.exec(payload.trim())?.[1] ?? null;
}
