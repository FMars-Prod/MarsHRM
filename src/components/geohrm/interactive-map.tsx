'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// This will prevent typescript errors if the google types are not available
declare global {
    interface Window {
        google: any;
    }
}

interface InteractiveMapProps {
  initialCenter: { lat: number; lng: number };
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  className?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ initialCenter, onLocationSelect, className }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Using `any` to avoid needing the full google.maps types
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);

  useEffect(() => {
    if (mapRef.current && !map && window.google?.maps?.places) { // Check for places library
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 17,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      setMap(newMap);

      const newMarker = new window.google.maps.Marker({
        position: initialCenter,
        map: newMap,
        draggable: true,
        title: 'Drag me to your location!',
      });
      setMarker(newMarker);

      // Update location on drag
      window.google.maps.event.addListener(newMarker, 'dragend', () => {
        const pos = newMarker.getPosition();
        if (pos) {
          onLocationSelect({ lat: pos.lat(), lng: pos.lng() });
        }
      });

      // Update location on map click
      window.google.maps.event.addListener(newMap, 'click', (e: any) => {
        if (e.latLng) {
            newMarker.setPosition(e.latLng);
            onLocationSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      });

      // Autocomplete search box
      if (searchInputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current);
        autocomplete.bindTo('bounds', newMap);

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
                // User entered the name of a Place that was not suggested and
                // pressed the Enter key, or the Place Details request failed.
                console.warn("No details available for input: '" + place.name + "'");
                return;
            }
            // If the place has a geometry, then present it on a map.
            if (place.geometry.viewport) {
                newMap.fitBounds(place.geometry.viewport);
            } else {
                newMap.setCenter(place.geometry.location);
                newMap.setZoom(17);
            }
            newMarker.setPosition(place.geometry.location);
            onLocationSelect({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
        });
      }
    }
  }, [mapRef, map, initialCenter, onLocationSelect]);

  // When initialCenter changes from the outside, re-center the map
  useEffect(() => {
      if (map && marker) {
          map.setCenter(initialCenter);
          marker.setPosition(initialCenter);
      }
  }, [initialCenter, map, marker]);

  return (
    <div className={cn('relative w-full h-full rounded-md', className)}>
        <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search for a location"
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 w-3/4 max-w-sm"
        />
        <div ref={mapRef} className='w-full h-full' />
    </div>
  );
};
