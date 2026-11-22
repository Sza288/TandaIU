import {
  getScheduleStatusCategory,
  matchesScheduleEntry,
  matchesScheduleSearch,
  matchesScheduleStatus,
} from './scheduleFilters';

const NOW = Date.parse('2026-11-21T10:00:00+07:00');

describe('schedule status filters', () => {
  it('treats an open session as passed after its end and keeps closed sessions passed', () => {
    expect(getScheduleStatusCategory({
      status: 'dibuka',
      startsAt: '2026-11-21T08:00:00+07:00',
      endsAt: '2026-11-21T09:00:00+07:00',
    }, NOW)).toBe('terlewati');
    expect(getScheduleStatusCategory({
      status: 'dibuka',
      startsAt: '2026-11-21T10:30:00+07:00',
      endsAt: '2026-11-21T11:30:00+07:00',
    }, NOW)).toBe('dibuka');
    expect(getScheduleStatusCategory({
      status: 'ditutup',
      startsAt: '2026-11-22T08:00:00+07:00',
      endsAt: '2026-11-22T09:00:00+07:00',
    }, NOW)).toBe('terlewati');
  });

  it('marks elapsed scheduled sessions as passed and upcoming sessions as future', () => {
    expect(getScheduleStatusCategory({
      status: 'terjadwal',
      startsAt: '2026-11-21T08:00:00+07:00',
      endsAt: '2026-11-21T09:00:00+07:00',
    }, NOW)).toBe('terlewati');
    expect(getScheduleStatusCategory({
      status: 'terjadwal',
      startsAt: '2026-11-21T09:30:00+07:00',
      endsAt: '2026-11-21T10:30:00+07:00',
    }, NOW)).toBe('terlewati');
    expect(getScheduleStatusCategory({
      status: 'terjadwal',
      startsAt: '2026-11-21T11:00:00+07:00',
      endsAt: '2026-11-21T12:00:00+07:00',
    }, NOW)).toBe('mendatang');
  });

  it('places a late-open session in exactly one category', () => {
    const expiredOpen = {
      status: 'dibuka' as const,
      startsAt: '2026-11-21T08:00:00+07:00',
      endsAt: '2026-11-21T09:00:00+07:00',
    };
    expect(getScheduleStatusCategory(expiredOpen, NOW)).toBe('terlewati');
    expect(matchesScheduleStatus(expiredOpen, 'dibuka', NOW)).toBe(false);
    expect(matchesScheduleStatus(expiredOpen, 'terlewati', NOW)).toBe(true);
    expect(matchesScheduleStatus(expiredOpen, 'mendatang', NOW)).toBe(false);
  });

  it('keeps all sessions in Semua and filters by one derived status at a time', () => {
    const upcoming = {
      status: 'terjadwal' as const,
      startsAt: '2026-11-21T11:00:00+07:00',
      endsAt: '2026-11-21T12:00:00+07:00',
    };
    expect(matchesScheduleStatus(upcoming, 'semua', NOW)).toBe(true);
    expect(matchesScheduleStatus(upcoming, 'mendatang', NOW)).toBe(true);
    expect(matchesScheduleStatus(upcoming, 'dibuka', NOW)).toBe(false);
    expect(matchesScheduleStatus(upcoming, 'terlewati', NOW)).toBe(false);
  });
});

describe('schedule search', () => {
  it('searches course and practicum labels case-insensitively', () => {
    expect(matchesScheduleSearch(['Basis Data', 'Kelas A'], 'bAsIs')).toBe(true);
    expect(matchesScheduleSearch(['Sistem Operasi'], 'pemrograman')).toBe(false);
    expect(matchesScheduleSearch(['Sistem Operasi'], '   ')).toBe(true);
  });

  it('combines status and search so both conditions must match', () => {
    const upcoming = {
      status: 'terjadwal' as const,
      startsAt: '2026-11-21T11:00:00+07:00',
      endsAt: '2026-11-21T12:00:00+07:00',
    };
    expect(matchesScheduleEntry(upcoming, ['Basis Data', 'Kelas A'], 'mendatang', 'basis', NOW))
      .toBe(true);
    expect(matchesScheduleEntry(upcoming, ['Basis Data', 'Kelas A'], 'dibuka', 'basis', NOW))
      .toBe(false);
    expect(matchesScheduleEntry(upcoming, ['Basis Data', 'Kelas A'], 'mendatang', 'sistem', NOW))
      .toBe(false);
  });
});
