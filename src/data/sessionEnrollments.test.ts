import {
  getPraktikanIdsForSession,
  getSessionIdsForPraktikan,
} from './sessionEnrollments';

describe('sessionEnrollments (FR-02 / FR-03 / FR-06)', () => {
  it('maps a session to praktikans in the matching semester', () => {
    const praktikanIds = getPraktikanIdsForSession('s5');

    expect(praktikanIds).toEqual(expect.arrayContaining(['p1', 'p5']));
    expect(praktikanIds).not.toContain('p6');
  });

  it('maps a praktikan to sessions in their own semester only', () => {
    const sessionIds = getSessionIdsForPraktikan('p1');

    expect(sessionIds).toEqual(expect.arrayContaining(['s2', 's4', 's5']));
    expect(sessionIds).not.toContain('s1');
    expect(sessionIds).not.toContain('s9');
  });

  it('returns an empty list for an unknown praktikan', () => {
    expect(getSessionIdsForPraktikan('ghost')).toEqual([]);
  });

  it('returns an empty list for an unknown session', () => {
    expect(getPraktikanIdsForSession('missing')).toEqual([]);
  });
});
