import { getErrorMessage } from '../../utils/errorMessage';
import { getNotificationStatusContent } from './notification.status';

describe('getNotificationStatusContent', () => {
  it('explains denied permission and offers system settings', () => {
    const content = getNotificationStatusContent({ status: 'denied', reason: null });

    expect(content?.action).toBe('settings');
    expect(content?.message).toContain('sesi dibuka');
    expect(content?.message).toContain('perubahan jadwal');
    expect(content?.message).toContain('hasil pengajuan izin');
    expect(content?.message).toContain('Pengaturan');
  });

  it('uses the registration reason and offers retry for token or network errors', () => {
    const reason = getErrorMessage('network').message;
    const content = getNotificationStatusContent({ status: 'error', reason });

    expect(content).toEqual({ message: reason, action: 'retry' });
  });

  it('falls back to the shared unknown message when an error has no reason', () => {
    const content = getNotificationStatusContent({ status: 'error', reason: '   ' });

    expect(content).toEqual({
      message: getErrorMessage('unknown').message,
      action: 'retry',
    });
  });

  it('explains unsupported platforms without an action', () => {
    const content = getNotificationStatusContent({ status: 'unsupported', reason: null });

    expect(content?.action).toBeNull();
    expect(content?.message).toContain('tidak didukung');
  });

  it('shows retry when permission is still pending', () => {
    const reason = 'Izin notifikasi belum diberikan.';
    const content = getNotificationStatusContent({ status: 'idle', reason });

    expect(content).toEqual({ message: reason, action: 'retry' });
  });

  it.each([
    ['granted', null],
    ['loading', null],
    ['idle', null],
  ] as const)('hides the banner for %s', (status, reason) => {
    expect(getNotificationStatusContent({ status, reason })).toBeNull();
  });
});
