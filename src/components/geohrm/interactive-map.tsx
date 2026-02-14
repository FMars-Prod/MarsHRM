'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    if (mapRef.current && !map && window.google) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 17,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      setMap(newMap);

      const marker = new window.google.maps.Marker({
        position: initialCenter,
        map: newMap,
        draggable: true,
        title: 'Drag me to your location!',
      });
      
      // Update location on drag
      google.maps.event.addListener(marker, 'dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          onLocationSelect({ lat: pos.lat(), lng: pos.lng() });
        }
      });
      
      // Update location on map click
      google.maps.event.addListener(newMap, 'click', (e: any) => {
        if (e.latLng) {
            marker.setPosition(e.latLng);
            onLocationSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      });
    }
  }, [mapRef, map, initialCenter, onLocationSelect]);
  
  // When initialCenter changes from the outside, re-center the map
  useEffect(() => {
      if (map) {
          map.setCenter(initialCenter);
      }
  }, [initialCenter, map]);

  return <div ref={mapRef} className={cn('w-full h-full rounded-md', className)} />;
};
