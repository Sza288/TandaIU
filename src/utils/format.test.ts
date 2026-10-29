import {
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatTime,
  formatTimeRange,
  getInitials,
} from './format';

const ISO = '2026-10-20T10:10:00+07:00';
const ISO_END = '2026-10-20T12:10:00+07:00';

describe('formatTime (UI-04)', () => {
  it('formats an ISO timestamp as HH:mm in WIB', () => {
    expect(formatTime(ISO)).toBe('10:10');
  });

  it('returns a placeholder for invalid timestamps', () => {
    expect(formatTime('not-a-date')).toBe('--:--');
  });
});

describe('formatTimeRange (UI-04)', () => {
  it('joins start and end times with a WIB suffix', () => {
    expect(formatTimeRange(ISO, ISO_END)).toBe('10:10 - 12:10 WIB');
  });
});

describe('date formatting (UI-04)', () => {
  it('formats a short date', () => {
    expect(formatDateShort(ISO)).toContain('2026');
  });

  it('formats a long date with month and year', () => {
    const result = formatDateLong(ISO);
    expect(result).toContain('Oktober');
    expect(result).toContain('2026');
  });

  it('combines date and time', () => {
    const result = formatDateTime(ISO);
    expect(result).toContain('2026');
    expect(result).toContain('10:10');
  });
});

describe('getInitials (FR-01)', () => {
  it('returns up to two uppercase initials', () => {
    expect(getInitials('Andi Pratama')).toBe('AP');
    expect(getInitials('Dewi Lestari')).toBe('DL');
    expect(getInitials('Citra')).toBe('C');
  });

  it('ignores extra whitespace', () => {
    expect(getInitials('  Andi   Pratama  ')).toBe('AP');
  });
});
