'use client';

import { useState } from 'react';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { reverseGeocode, type AddressParts } from '@/lib/geocode';

const DEFAULT_LOCATION: AddressParts = {
  lat: 10.8087,
  lon: 78.7491,
  fullAddress: '',
};

function LocationField({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs font-medium text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  );
}

export function LocationCard() {
  const [location, setLocation] = useState<AddressParts>(DEFAULT_LOCATION);
  const [locating, setLocating] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const fetchLocation = async (lat: number, lon: number, live: boolean) => {
    try {
      const data = await reverseGeocode(lat, lon);
      setLocation(data);
      setIsLive(live);
      const hasAddress = data.street || data.village || data.district || data.state || data.fullAddress;
      if (hasAddress) {
        toast.success('Live location updated with address details.');
      } else {
        toast.success('Location updated, but no address details found for this area.');
      }
    } catch (err) {
      setLocation((prev) => ({ ...prev, lat, lon }));
      setIsLive(live);
      toast.error('Could not fetch address for this location. Please enter it manually.');
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchLocation(pos.coords.latitude, pos.coords.longitude, true).finally(() => {
          setLocating(false);
        });
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please allow location access in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast.error('Your location could not be determined.');
        } else if (err.code === err.TIMEOUT) {
          toast.error('Location request timed out. Please try again.');
        } else {
          toast.error('Could not access your location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-navy flex items-center gap-2">
          <MapPin className="h-5 w-5 text-accent" />
          Location Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Live indicator */}
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-3 w-3">
            {isLive && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            )}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${isLive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
          </span>
          <span className={`text-sm font-semibold ${isLive ? 'text-green-600' : 'text-muted-foreground'}`}>
            {isLive ? 'Live Location' : 'Default Location'}
          </span>
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
          </span>
        </div>

        {locating ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Fetching address...</span>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-0.5">
            <LocationField label="Street Number" value={location.streetNumber} />
            <LocationField label="Street / Road" value={location.street} />
            <LocationField label="Village" value={location.village} />
            <LocationField label="District" value={location.district} />
            <LocationField label="Village PIN Code" value={location.pincode} />
            <LocationField label="State" value={location.state} />
            {!location.street && !location.village && !location.district && !location.state && !location.fullAddress && (
              <div className="py-2 text-sm text-muted-foreground text-center">
                Click "Use My Live Location" to detect your address.
              </div>
            )}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="w-full mt-3 gap-2"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {locating ? 'Detecting your location...' : 'Use My Live Location'}
        </Button>
      </CardContent>
    </Card>
  );
}
