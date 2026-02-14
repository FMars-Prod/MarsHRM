'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LocateFixed } from 'lucide-react';

// This will prevent typescript errors if the google types are not available
declare global {
    interface Window {
        google: any;
    }
}

interface InteractiveMapProps {
  initialCenter: { lat: number; lng: number };
  onLocationSelect: (location: { lat: number; lng: number, address: string }) => void;
  className?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ initialCenter, onLocationSelect, className }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [geocoder, setGeocoder] = useState<any>(null);
  const [autocomplete, setAutocomplete] = useState<any>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('Getting address...');

  // Function to get address from lat/lng
  const getAddressFromLatLng = (latLng: any) => {
    if (!geocoder) return;
    geocoder.geocode({ location: latLng }, (results: any[], status: string) => {
        let address = "Address not found";
        if (status === 'OK' && results[0]) {
            address = results[0].formatted_address;
        } else {
            console.warn('Geocoder failed due to: ' + status);
        }
        setSelectedAddress(address);
        onLocationSelect({ lat: latLng.lat(), lng: latLng.lng(), address });
    });
  };

  // Initialize Map
  useEffect(() => {
    if (mapRef.current && !map && window.google?.maps) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 17,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      setMap(newMap);
      setGeocoder(new window.google.maps.Geocoder());

      const newMarker = new window.google.maps.Marker({
        position: initialCenter,
        map: newMap,
        draggable: true,
        title: 'Drag me to your location!',
      });
      setMarker(newMarker);
    }
  }, [mapRef, map, initialCenter]);
  
  // Setup marker listeners
  useEffect(() => {
      if(marker && geocoder) {
        getAddressFromLatLng(marker.getPosition()); // Initial address fetch

        const dragListener = window.google.maps.event.addListener(marker, 'dragend', () => {
          getAddressFromLatLng(marker.getPosition());
        });
        
        const mapClickListener = window.google.maps.event.addListener(map, 'click', (e: any) => {
            if (e.latLng) {
                marker.setPosition(e.latLng);
                getAddressFromLatLng(e.latLng);
            }
        });

        return () => {
            window.google.maps.event.removeListener(dragListener);
            window.google.maps.event.removeListener(mapClickListener);
        }
      }
  }, [marker, geocoder, onLocationSelect, map]);


  // Setup autocomplete
  useEffect(() => {
    if (searchInputRef.current && map && !autocomplete && window.google?.maps?.places) {
        const ac = new window.google.maps.places.Autocomplete(searchInputRef.current, {
            fields: ["formatted_address", "geometry", "name"],
            types: ["address"],
        });
        ac.bindTo("bounds", map);
        setAutocomplete(ac);

        ac.addListener("place_changed", () => {
            const place = ac.getPlace();
            if (place.geometry && place.geometry.location) {
                map.setCenter(place.geometry.location);
                map.setZoom(17);
                marker.setPosition(place.geometry.location);
                getAddressFromLatLng(place.geometry.location);
            } else {
                window.alert("No details available for input: '" + place.name + "'");
            }
        });
    }
  }, [searchInputRef, map, marker, autocomplete]);
  
  // Re-center map when initialCenter changes
  useEffect(() => {
      if (map && marker) {
          map.setCenter(initialCenter);
          marker.setPosition(initialCenter);
          getAddressFromLatLng(initialCenter);
      }
  }, [initialCenter, map, marker]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };
            map.setCenter(pos);
            marker.setPosition(pos);
            getAddressFromLatLng(pos);
        }, () => {
            alert('Error: The Geolocation service failed.');
        });
    } else {
        alert('Error: Your browser doesn\'t support geolocation.');
    }
  };

  return (
    <div className={cn('relative w-full h-full rounded-md', className)}>
        <Input
            ref={searchInputRef}
            placeholder="Search for a location..."
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 w-3/4 max-w-sm"
        />
        <div ref={mapRef} className='w-full h-full' />
        <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={handleGetCurrentLocation}
            className="absolute bottom-10 right-2 z-10"
        >
            <LocateFixed className="h-5 w-5" />
            <span className="sr-only">Get Current Location</span>
        </Button>
    </div>
  );
};
