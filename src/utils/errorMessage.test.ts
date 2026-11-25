import { getErrorKind, getErrorMessage, type ErrorKind } from './errorMessage';

const ALL_KINDS: ErrorKind[] = [
  'network',
  'timeout',
  'permission',
  'unavailable',
  'notification-permission',
  'token-unavailable',
  'unknown',
];

const CODE_CASES: [string, ErrorKind][] = [
  ['auth/network-request-failed', 'network'],
  ['network-request-failed', 'network'],
  ['timeout', 'timeout'],
  ['permission-denied', 'permission'],
  ['unavailable', 'unavailable'],
  ['deadline-exceeded', 'unavailable'],
  ['notification-permission', 'notification-permission'],
  ['notification-permission-denied', 'notification-permission'],
  ['token-unavailable', 'token-unavailable'],
  ['notification-token-unavailable', 'token-unavailable'],
];

const EXPECTED_MESSAGES: Record<ErrorKind, string> = {
  network: 'Koneksi terputus. Periksa internetmu lalu coba lagi.',
  timeout: 'Proses memakan waktu terlalu lama. Silakan coba lagi.',
  permission: 'Akses ditolak. Periksa izin akunmu lalu coba lagi.',
  unavailable: 'Layanan sedang tidak tersedia. Periksa internet lalu coba lagi.',
  'notification-permission': 'Izin notifikasi ditolak. Aktifkan izin notifikasi di pengaturan aplikasi.',
  'token-unavailable': 'Token perangkat tidak tersedia. Coba lagi sebentar.',
  unknown: 'Ada kendala saat menghubungkan akun. Coba lagi sebentar.',
};

describe('getErrorKind (S3-SRS-16)', () => {
  it.each(CODE_CASES)('maps code %s to %s', (code, expected) => {
    expect(getErrorKind({ code })).toBe(expected);
  });

  it('returns unknown for non-object input', () => {
    expect(getErrorKind(null)).toBe('unknown');
    expect(getErrorKind(undefined)).toBe('unknown');
    expect(getErrorKind(42)).toBe('unknown');
    expect(getErrorKind('network-request-failed')).toBe('unknown');
  });

  it('returns unknown for a missing, non-string, or unrecognized code', () => {
    expect(getErrorKind({})).toBe('unknown');
    expect(getErrorKind({ code: 503 })).toBe('unknown');
    expect(getErrorKind({ code: 'something-else' })).toBe('unknown');
  });

  it('ignores error.message', () => {
    expect(getErrorKind({ message: 'Koneksi terputus. Periksa internetmu lalu coba lagi.' })).toBe('unknown');
    expect(getErrorKind({ code: 'unavailable', message: 'pesan apa saja' })).toBe('unavailable');
  });

  it('trims the code before matching', () => {
    expect(getErrorKind({ code: '  timeout  ' })).toBe('timeout');
  });
});

describe('getErrorMessage (S3-SRS-16)', () => {
  it.each(ALL_KINDS)('provides a friendly message for %s', (kind) => {
    expect(getErrorMessage(kind).message).toBe(EXPECTED_MESSAGES[kind]);
  });

  it('marks only recoverable kinds as retryable', () => {
    const retryable = new Set<ErrorKind>([
      'network',
      'timeout',
      'unavailable',
      'token-unavailable',
    ]);

    ALL_KINDS.forEach((kind) => {
      expect(getErrorMessage(kind).retryable).toBe(retryable.has(kind));
    });
  });
});
