import { addDoc, getDoc, getDocs, updateDoc } from 'firebase/firestore';

import {
  createLaboratory,
  normalizeLaboratoryName,
  updateLaboratory,
  validateLaboratoryInput,
} from '../services/laboratoryService';
import type { LaboratoryInput } from '../types/praktikum';

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('../lib/firebase', () => ({
  db: {},
}));

const validLaboratory: LaboratoryInput = {
  name: 'Laboratorium B',
  latitude: -7.0482469,
  longitude: 110.4407531,
  radius: 500,
  lantai: 2,
  createdAt: '2026-11-23T08:00:00.000Z',
  updatedAt: '2026-11-23T08:00:00.000Z',
};

function laboratoryDocument(overrides: Partial<LaboratoryInput> = {}, id = 'lab-b') {
  return {
    id,
    data: () => ({ ...validLaboratory, ...overrides }),
    exists: () => true,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validateLaboratoryInput', () => {
  it('accepts a valid laboratory', () => {
    expect(() => validateLaboratoryInput(validLaboratory)).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => validateLaboratoryInput({ ...validLaboratory, name: '' })).toThrow(
      /Nama laboratorium/i,
    );
    expect(() => validateLaboratoryInput({ ...validLaboratory, name: '   ' })).toThrow(
      /Nama laboratorium/i,
    );
  });

  it('rejects latitude outside -90..90', () => {
    expect(() =>
      validateLaboratoryInput({ ...validLaboratory, latitude: -90.0001 }),
    ).toThrow(/Latitude/i);
    expect(() =>
      validateLaboratoryInput({ ...validLaboratory, latitude: 90.0001 }),
    ).toThrow(/Latitude/i);
  });

  it('rejects longitude outside -180..180', () => {
    expect(() =>
      validateLaboratoryInput({ ...validLaboratory, longitude: -180.5 }),
    ).toThrow(/Longitude/i);
    expect(() =>
      validateLaboratoryInput({ ...validLaboratory, longitude: 180.5 }),
    ).toThrow(/Longitude/i);
  });

  it('rejects non numeric coordinates', () => {
    expect(() =>
      validateLaboratoryInput({ ...validLaboratory, latitude: Number.NaN }),
    ).toThrow(/Latitude/i);
    expect(() =>
      validateLaboratoryInput({ ...validLaboratory, longitude: Number.POSITIVE_INFINITY }),
    ).toThrow(/Longitude/i);
  });

  it('rejects radius outside 1..500', () => {
    expect(() => validateLaboratoryInput({ ...validLaboratory, radius: 0 })).toThrow(
      /Radius/i,
    );
    expect(() => validateLaboratoryInput({ ...validLaboratory, radius: -10 })).toThrow(
      /Radius/i,
    );
    expect(() => validateLaboratoryInput({ ...validLaboratory, radius: 501 })).toThrow(
      /Radius/i,
    );
    expect(() => validateLaboratoryInput({ ...validLaboratory, radius: 700 })).toThrow(
      /Radius/i,
    );
  });

  it('rejects a fractional radius', () => {
    expect(() => validateLaboratoryInput({ ...validLaboratory, radius: 12.5 })).toThrow(
      /bulat/i,
    );
  });

  it('rejects lantai outside 1..6 or not an integer', () => {
    expect(() => validateLaboratoryInput({ ...validLaboratory, lantai: 0 })).toThrow(
      /Lantai/i,
    );
    expect(() => validateLaboratoryInput({ ...validLaboratory, lantai: -1 })).toThrow(
      /Lantai/i,
    );
    expect(() => validateLaboratoryInput({ ...validLaboratory, lantai: 7 })).toThrow(
      /Lantai/i,
    );
    expect(() => validateLaboratoryInput({ ...validLaboratory, lantai: 9999 })).toThrow(
      /Lantai/i,
    );
    expect(() => validateLaboratoryInput({ ...validLaboratory, lantai: 2.5 })).toThrow(
      /bulat/i,
    );
  });

  it('rejects invalid timestamps', () => {
    expect(() =>
      validateLaboratoryInput({ ...validLaboratory, createdAt: 'bukan-tanggal' }),
    ).toThrow(/tanggal/i);
    expect(() =>
      validateLaboratoryInput({ ...validLaboratory, updatedAt: '' }),
    ).toThrow(/tanggal/i);
  });
});

describe('normalizeLaboratoryName', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(normalizeLaboratoryName('  Laboratorium B ')).toBe('laboratorium b');
    expect(normalizeLaboratoryName('LABORATORIUM  B')).toBe('laboratorium b');
  });
});

describe('createLaboratory', () => {
  it('rejects a duplicate name regardless of case', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [laboratoryDocument({ name: 'lab-b' })],
    });

    await expect(
      createLaboratory({ ...validLaboratory, name: '  Lab-B ' }),
    ).rejects.toThrow(/sudah dipakai/i);

    expect(addDoc).not.toHaveBeenCalled();
  });

  it('writes trimmed data when the name is unique', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    (addDoc as jest.Mock).mockResolvedValue({ id: 'lab-new' });

    await expect(
      createLaboratory({ ...validLaboratory, name: '  Laboratorium E  ' }),
    ).resolves.toMatchObject({ id: 'lab-new', name: 'Laboratorium E' });

    expect(addDoc).toHaveBeenCalledTimes(1);
  });
});

describe('updateLaboratory', () => {
  it('does not flag the laboratory being edited as a duplicate', async () => {
    (getDoc as jest.Mock).mockResolvedValue(laboratoryDocument());
    (getDocs as jest.Mock).mockResolvedValue({ docs: [laboratoryDocument()] });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await expect(updateLaboratory('lab-b', validLaboratory)).resolves.toMatchObject({
      id: 'lab-b',
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  it('rejects a name already used by another laboratory', async () => {
    (getDoc as jest.Mock).mockResolvedValue(laboratoryDocument());
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [laboratoryDocument({ name: 'Laboratorium C' }, 'lab-c')],
    });

    await expect(
      updateLaboratory('lab-b', { ...validLaboratory, name: 'laboratorium c' }),
    ).rejects.toThrow(/sudah dipakai/i);

    expect(updateDoc).not.toHaveBeenCalled();
  });
});
