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
  // Using `any` to avoid needing the full google.maps types
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);

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
        <div ref={mapRef} className='w-full h-full' />
    </div>
  );
};
