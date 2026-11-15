import { getAuthenticatedPraktikanIdentity } from './authenticatedIdentity';
import { getSessionIdsForPraktikan } from '../../data/sessionEnrollments';

describe('getAuthenticatedPraktikanIdentity', () => {
  it('keeps Firestore identity separate from local demo IDs even when the student code matches', () => {
    const identity = getAuthenticatedPraktikanIdentity({
      uid: 'firebase-uid-1',
      name: 'Nama dari Firestore',
      email: 'praktikan@example.com',
      role: 'praktikan',
      studentCode: '24060124120001',
    });

    expect(identity).toEqual({
      id: 'firebase-uid-1',
      name: 'Nama dari Firestore',
      studentCode: '24060124120001',
    });
    expect(identity?.localScheduleId).toBeUndefined();
    expect(identity && getSessionIdsForPraktikan(identity.localScheduleId ?? '')).toEqual([]);
  });

  it('uses the Firebase UID when the account has no student code', () => {
    expect(getAuthenticatedPraktikanIdentity({
      uid: 'firebase-uid-2',
      name: 'Akun Baru',
      email: 'baru@example.com',
      role: 'praktikan',
    })).toEqual({
      id: 'firebase-uid-2',
      name: 'Akun Baru',
    });
  });

  it('does not create a praktikan identity for an assistant profile', () => {
    expect(getAuthenticatedPraktikanIdentity({
      uid: 'assistant-uid',
      name: 'Asisten',
      email: 'asisten@example.com',
      role: 'assistant',
    })).toBeNull();
  });
});
