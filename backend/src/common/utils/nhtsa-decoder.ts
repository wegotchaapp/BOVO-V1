export interface VinDecodeResult {
  make: string;
  model: string;
  year: string;
  body_class: string;
  vehicle_type: string;
  wheelbase: string;
  beds: string | null;
  seating_rows: string | null;
  error_code: string;
  error_text: string;
  possible_values: string | null;
}

export interface VinDecodeResponse {
  results: VinDecodeResult[];
  count: number;
  error: boolean;
}

export function decodeVehicleCategory(decoded: VinDecodeResult[]): {
  category: string;
  luggage_class: string;
  max_passengers: number;
  reason: string;
} {
  if (!decoded.length || decoded[0].error_code !== '0') {
    return {
      category: 'standard_sedan',
      luggage_class: 'medium',
      max_passengers: 4,
      reason: 'VIN decode failed, defaulting to standard sedan',
    };
  }

  const data = decoded[0];
  const vehicleType = (data.vehicle_type || '').toLowerCase();
  const bodyClass = (data.body_class || '').toLowerCase();
  const wheelbaseInches = parseFloat(data.wheelbase || '0');
  const seatingRows = parseInt(data.seating_rows || '1', 10);
  const beds = data.beds;

  if (vehicleType.includes('passenger car')) {
    if (wheelbaseInches > 110) {
      return {
        category: 'standard_sedan',
        luggage_class: 'medium',
        max_passengers: 4,
        reason: `Passenger car with ${wheelbaseInches}" wheelbase → standard sedan`,
      };
    }
    return {
      category: 'compact',
      luggage_class: 'small',
      max_passengers: 4,
      reason: `Passenger car with ${wheelbaseInches}" wheelbase → compact`,
    };
  }

  if (vehicleType.includes('truck') || bodyClass.includes('pickup')) {
    return {
      category: 'truck',
      luggage_class: 'large',
      max_passengers: beds && parseInt(beds) > 0 ? 3 : 4,
      reason: `Pickup truck${beds ? ` with ${beds} bed(s)` : ''} → truck`,
    };
  }

  if (vehicleType.includes('multipurpose') || bodyClass.includes('mpv') || bodyClass.includes('suv')) {
    if (seatingRows >= 3 || bodyClass.includes('large') || bodyClass.includes('suburban')) {
      return {
        category: 'large_suv',
        luggage_class: 'large',
        max_passengers: seatingRows >= 3 ? 7 : 5,
        reason: `MPV/SUV with ${seatingRows} seating rows → large SUV`,
      };
    }
    return {
      category: 'suv_crossover',
      luggage_class: 'medium',
      max_passengers: 5,
      reason: `MPV/SUV with ${seatingRows} seating row(s) → SUV/crossover`,
    };
  }

  if (vehicleType.includes('van') || bodyClass.includes('van')) {
    return {
      category: 'van',
      luggage_class: 'large',
      max_passengers: 7,
      reason: 'Van detected → van category',
    };
  }

  return {
    category: 'standard_sedan',
    luggage_class: 'medium',
    max_passengers: 4,
    reason: `Unrecognized type (${data.vehicle_type}), defaulting to standard sedan`,
  };
}
