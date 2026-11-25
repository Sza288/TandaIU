import {
  addHoursToDateTime,
  combineDateTime,
  fromDateTimeInput,
  scheduleMeetingDates,
  splitDateTimeInput,
  weekdayOfDate,
} from './crud.utils';

describe('session form Asia/Jakarta date handling', () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

  it.each(['Asia/Jakarta', 'UTC', 'America/Los_Angeles'])('is device-independent on %s', (timezone) => {
    process.env.TZ = timezone;
    const storedInstant = '2026-10-27T06:00:00.000Z';
    const fields = splitDateTimeInput(storedInstant);

    expect(fields).toEqual({ date: '2026-10-27', time: '13:00' });
    expect(combineDateTime(fields.date, fields.time)).toBe(storedInstant);
  });

  it('preserves the instant on an unchanged edit and maps an edited hour to WIB', () => {
    process.env.TZ = 'America/Los_Angeles';
    const existing = '2026-10-27T13:00:45.678+07:00';
    const fields = splitDateTimeInput(existing);

    expect(combineDateTime(fields.date, fields.time, existing)).toBe(existing);
    expect(Date.parse(combineDateTime(fields.date, fields.time, existing)))
      .toBe(Date.parse('2026-10-27T06:00:45.678Z'));
    expect(combineDateTime(fields.date, '14:00', existing)).toBe('2026-10-27T07:00:00.000Z');
  });

  it('handles midnight, day, month, and year boundaries as Jakarta wall time', () => {
    process.env.TZ = 'UTC';
    expect(fromDateTimeInput('2026-10-31T23:30')).toBe('2026-10-31T16:30:00.000Z');
    expect(addHoursToDateTime('2026-10-31', '23:30', 2))
      .toEqual({ date: '2026-11-01', time: '01:30' });
    expect(addHoursToDateTime('2026-12-31', '23:30', 2))
      .toEqual({ date: '2027-01-01', time: '01:30' });
  });
});

describe('scheduleMeetingDates', () => {
  it('uses the chosen date as the first meeting and steps one week', () => {
    expect(scheduleMeetingDates(3, '2026-11-23')).toEqual([
      '2026-11-23',
      '2026-11-30',
      '2026-12-07',
    ]);
  });

  it('keeps a chosen date even when it is not the schedule weekday', () => {
    // 2026-11-24 is a Tuesday; the chosen date must not be shifted.
    expect(scheduleMeetingDates(2, '2026-11-24')).toEqual([
      '2026-11-24',
      '2026-12-01',
    ]);
  });

  it('wraps correctly across month and year boundaries', () => {
    expect(scheduleMeetingDates(3, '2026-12-21')).toEqual([
      '2026-12-21',
      '2026-12-28',
      '2027-01-04',
    ]);
  });

  it('returns nothing for a non-positive or invalid count', () => {
    expect(scheduleMeetingDates(0, '2026-11-23')).toEqual([]);
    expect(scheduleMeetingDates(-3, '2026-11-23')).toEqual([]);
    expect(scheduleMeetingDates(2, 'bukan-tanggal')).toEqual([]);
  });
});

describe('weekdayOfDate', () => {
  it('returns the weekday index for a valid date', () => {
    expect(weekdayOfDate('2026-11-23')).toBe(1);
    expect(weekdayOfDate('2026-11-24')).toBe(2);
  });

  it('returns null for an invalid date', () => {
    expect(weekdayOfDate('bukan-tanggal')).toBeNull();
  });
});
