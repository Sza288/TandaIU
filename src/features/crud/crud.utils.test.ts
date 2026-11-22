import {
  addHoursToDateTime,
  combineDateTime,
  fromDateTimeInput,
  splitDateTimeInput,
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
