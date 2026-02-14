
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
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [geocoder, setGeocoder] = useState<any>(null);
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
        // Handle both google.maps.LatLng and {lat, lng} objects
        const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
        const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
        onLocationSelect({ lat, lng, address });
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
        <div ref={mapRef} className='w-full h-full' />
        <Button
            type="button"
            variant="secondary"
            onClick={handleGetCurrentLocation}
            className="absolute bottom-2 right-2 z-10"
        >
            <LocateFixed className="mr-2 h-4 w-4" />
            My Location
        </Button>
    </div>
  );
};
