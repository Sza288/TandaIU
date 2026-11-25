export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'permission'
  | 'unavailable'
  | 'notification-permission'
  | 'token-unavailable'
  | 'unknown';

export type ErrorMessageInfo = {
  message: string;
  retryable: boolean;
};

const ERROR_MESSAGES: Record<ErrorKind, ErrorMessageInfo> = {
  network: {
    message: 'Koneksi terputus. Periksa internetmu lalu coba lagi.',
    retryable: true,
  },
  timeout: {
    message: 'Proses memakan waktu terlalu lama. Silakan coba lagi.',
    retryable: true,
  },
  permission: {
    message: 'Akses ditolak. Periksa izin akunmu lalu coba lagi.',
    retryable: false,
  },
  unavailable: {
    message: 'Layanan sedang tidak tersedia. Periksa internet lalu coba lagi.',
    retryable: true,
  },
  'notification-permission': {
    message: 'Izin notifikasi ditolak. Aktifkan izin notifikasi di pengaturan aplikasi.',
    retryable: false,
  },
  'token-unavailable': {
    message: 'Token perangkat tidak tersedia. Coba lagi sebentar.',
    retryable: true,
  },
  unknown: {
    message: 'Ada kendala saat menghubungkan akun. Coba lagi sebentar.',
    retryable: false,
  },
};

const CODE_KINDS: Record<string, ErrorKind> = {
  'auth/network-request-failed': 'network',
  'network-request-failed': 'network',
  timeout: 'timeout',
  'permission-denied': 'permission',
  unavailable: 'unavailable',
  'deadline-exceeded': 'unavailable',
  'notification-permission': 'notification-permission',
  'notification-permission-denied': 'notification-permission',
  'token-unavailable': 'token-unavailable',
  'notification-token-unavailable': 'token-unavailable',
};

export function getErrorKind(error: unknown): ErrorKind {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'unknown';
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') return 'unknown';

  return CODE_KINDS[code.trim()] ?? 'unknown';
}

export function getErrorMessage(kind: ErrorKind): ErrorMessageInfo {
  return ERROR_MESSAGES[kind];
}
