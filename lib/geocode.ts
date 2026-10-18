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

type AdminEntry = { name?: string; adminLevel?: number; description?: string };

function fromAdministrative(admin: AdminEntry[] | undefined, levels: number[]): string {
  if (!Array.isArray(admin)) return '';
  for (const level of levels) {
    const match = admin.find((e) => e?.adminLevel === level && e.name);
    if (match?.name) return match.name;
  }
  return '';
}

function pick(...values: (string | undefined)[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

interface NominatimResponse {
  address?: Record<string, string | undefined>;
  display_name?: string;
  error?: string;
}

// Primary: server-side proxy to Nominatim via the geocode edge function.
// Returns accurate village/hamlet names for rural India.
async function reverseGeocodePrimary(lat: number, lon: number): Promise<AddressParts> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const url = `${supabaseUrl}/functions/v1/geocode?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!res.ok) throw new Error(`Geocoding service failed (${res.status})`);
  const data: NominatimResponse = await res.json();
  if (data.error) throw new Error(data.error);

  const a = data.address || {};

  const street = pick(a.road, a.pedestrian, a.footway, a.residential, a.neighbourhood);
  const village = pick(a.village, a.hamlet, a.town, a.locality, a.suburb, a.city_district, a.quarter, a.city);
  const district = pick(a.state_district, a.district, a.county);
  const state = pick(a.state, a.province);
  const country = pick(a.country);
  const pincode = pick(a.postcode);

  const fullAddress = [street, village, district, state, country].filter(Boolean).join(', ');

  return {
    streetNumber: a.house_number || '',
    street,
    village,
    district,
    pincode,
    state,
    country,
    fullAddress: fullAddress || data.display_name || '',
    lat,
    lon,
  };
}

// Fallback: direct BigDataCloud lookup.
async function reverseGeocodeFallback(lat: number, lon: number): Promise<AddressParts> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fallback geocoding failed (${res.status})`);
  const data = await res.json();

  const admin: AdminEntry[] | undefined = data.localityInfo?.administrative;
  // India admin levels: 4 = state, 5 = district, 6/7 = sub-district/taluk
  const state = fromAdministrative(admin, [4]) || data.principalSubdivision || '';
  const district = fromAdministrative(admin, [5]) || fromAdministrative(admin, [6]) || '';
  const village = data.locality || data.principalLocality || data.subLocality || '';
  const street = data.streetName || '';
  const country = data.countryName || '';
  const pincode = data.postcode || '';

  const fullAddress = [street, village, district, state, country].filter(Boolean).join(', ');

  return {
    streetNumber: data.houseNumber || '',
    street,
    village,
    district,
    pincode,
    state,
    country,
    fullAddress: fullAddress || data.locality || '',
    lat,
    lon,
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<AddressParts> {
  try {
    return await reverseGeocodePrimary(lat, lon);
  } catch {
    try {
      return await reverseGeocodeFallback(lat, lon);
    } catch {
      throw new Error('All geocoding services failed');
    }
  }
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
  if (parts.state) segments.push(parts.state);
  if (parts.pincode) segments.push(parts.pincode);

  if (segments.length === 0) {
    return parts.fullAddress || `${parts.lat.toFixed(5)}, ${parts.lon.toFixed(5)}`;
  }
  return segments.join(', ');
}
