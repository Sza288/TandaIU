import { praktikanAccounts } from './praktikanAccounts';

describe('praktikanAccounts (daftar suggestion login)', () => {
  const emails = praktikanAccounts.map((account) => account.email.toLowerCase());

  it('menempatkan asprak1 paling atas', () => {
    expect(praktikanAccounts[0].email).toBe('asprak1@tandaiu.com');
  });

  it('menempatkan praktikan1, Husni, dan akun example di paling bawah', () => {
    const last3 = praktikanAccounts.slice(-3).map((account) => account.email);
    expect(last3).toEqual([
      'praktikan1@tandaiu.com',
      'husniulyaa11@gmail.com',
      'test@example.com',
    ]);
  });

  it('memuat keempat akun uji', () => {
    expect(emails).toContain('asprak1@tandaiu.com');
    expect(emails).toContain('praktikan1@tandaiu.com');
    expect(emails).toContain('husniulyaa11@gmail.com');
    expect(emails).toContain('test@example.com');
  });

  it('tidak menghasilkan email duplikat', () => {
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('tetap memuat 31 praktikan asli di bagian tengah', () => {
    const praktikanEntries = praktikanAccounts.filter((account) => account.semester !== undefined);
    expect(praktikanEntries).toHaveLength(31);
    expect(praktikanEntries[0].email).not.toBe('asprak1@tandaiu.com');
  });

  it('mempertahankan urutan asli praktikan setelah asprak1', () => {
    expect(praktikanAccounts[1].email).toBe('andi.pratama@tandaiu.com');
    expect(praktikanAccounts[2].email).toBe('budi.santoso@tandaiu.com');
  });

  it('menyimpan email yang benar untuk setiap akun uji', () => {
    const asprak = praktikanAccounts.find((a) => a.email === 'asprak1@tandaiu.com');
    expect(asprak).toMatchObject({ name: 'Asprak 1', note: 'Asisten' });
    expect(asprak?.semester).toBeUndefined();

    const example = praktikanAccounts.find((a) => a.email === 'test@example.com');
    expect(example?.email).toBe('test@example.com');
  });

  it('akun uji tidak punya semester sehingga memakai keterangan', () => {
    const account = praktikanAccounts.find((a) => !a.semester);
    expect(account?.semester).toBeUndefined();
    expect(account?.note).toBe('Asisten');
  });
});
