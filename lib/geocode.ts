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

async function reverseGeocodePrimary(lat: number, lon: number): Promise<AddressParts> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Primary geocoding failed (${res.status})`);
  const data = await res.json();

  const street = data.streetName || data.locality || data.principalLocality || '';
  const village = data.city || data.locality || data.principalLocality || data.subLocality || '';
  const district = data.principalSubdivision || data.localityInfo?.administrative?.[0]?.name || '';
  const state = data.principalSubdivision || '';
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

async function reverseGeocodeFallback(lat: number, lon: number): Promise<AddressParts> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Fallback geocoding failed (${res.status})`);
  const json = await res.json();
  const a = json.address || {};

  const street = a.road || a.pedestrian || a.footway || a.cycleway || a.path || '';
  const village = a.village || a.hamlet || a.suburb || a.neighbourhood || a.town || a.city_district || a.quarter || '';
  const district = a.state_district || a.county || a.district || a.city || '';
  const state = a.state || a.province || '';
  const country = a.country || '';
  const pincode = a.postcode || '';

  const fullAddress = json.display_name || '';

  return {
    streetNumber: a.house_number || '',
    street,
    village,
    district,
    pincode,
    state,
    country,
    fullAddress,
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
  if (parts.pincode) segments.push(parts.pincode);
  if (parts.state) segments.push(parts.state);

  if (segments.length === 0) {
    return parts.fullAddress || `${parts.lat.toFixed(5)}, ${parts.lon.toFixed(5)}`;
  }
  return segments.join(', ');
}
