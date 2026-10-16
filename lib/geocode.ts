export type AddressParts = {
  streetNumber?: string;
  street?: string;
  village?: string;
  district?: string;
  pincode?: string;
  state?: string;
  country?: string;
  fullAddress: string;
  lat: number;
  lon: number;
};

export async function reverseGeocode(lat: number, lon: number): Promise<AddressParts> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const url = `${supabaseUrl}/functions/v1/geocode?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const json = await res.json();

  if (json.error) throw new Error(json.error);

  const a = json.address || {};

  return {
    streetNumber: a.house_number || '',
    street: a.road || a.pedestrian || a.footway || a.cycleway || a.path || '',
    village: a.village || a.hamlet || a.suburb || a.neighbourhood || a.town || a.city_district || a.quarter || '',
    district: a.state_district || a.county || a.district || a.city || '',
    pincode: a.postcode || '',
    state: a.state || a.province || '',
    country: a.country || '',
    fullAddress: json.display_name || '',
    lat,
    lon,
  };
}

export function formatAddress(parts: AddressParts): string {
  const segments: string[] = [];

  if (parts.street && parts.streetNumber) {
    segments.push(`${parts.streetNumber} ${parts.street}`);
  } else if (parts.street) {
    segments.push(parts.street);
  }
  if (parts.village) segments.push(parts.village);
  if (parts.district) segments.push(parts.district);
  if (parts.pincode) segments.push(parts.pincode);
  if (parts.state) segments.push(parts.state);

  if (segments.length === 0) {
    return parts.fullAddress || `${parts.lat.toFixed(5)}, ${parts.lon.toFixed(5)}`;
  }
  return segments.join(', ');
}
