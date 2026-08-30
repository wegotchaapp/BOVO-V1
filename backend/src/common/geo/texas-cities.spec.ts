import { cityCoordinates, SUPPORTED_CITIES } from './texas-cities';

describe('cityCoordinates', () => {
  it('resolves the form the app stores', () => {
    expect(cityCoordinates('Dallas, TX')).toEqual({
      latitude: 32.7767,
      longitude: -96.797,
    });
  });

  it('resolves without the state suffix, and case-insensitively', () => {
    expect(cityCoordinates('dallas')).toEqual(cityCoordinates('Dallas, TX'));
    expect(cityCoordinates('FORT WORTH')).toEqual(
      cityCoordinates('Fort Worth, TX'),
    );
  });

  it('handles two-word cities', () => {
    expect(cityCoordinates('Corpus Christi, TX')).not.toBeNull();
    expect(cityCoordinates('El Paso, TX')).not.toBeNull();
  });

  it('returns null rather than guessing for an unknown city', () => {
    expect(cityCoordinates('Oklahoma City, OK')).toBeNull();
    expect(cityCoordinates('')).toBeNull();
    expect(cityCoordinates(null)).toBeNull();
  });

  it('covers all twelve cities the app offers', () => {
    expect(SUPPORTED_CITIES).toHaveLength(12);
  });
});
