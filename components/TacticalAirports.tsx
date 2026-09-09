import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import { GeoJSON, Pane } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import { loadTacticalGeoJson } from './tacticalMapData';

const AIRPORT_DATA_URL = `${import.meta.env.BASE_URL}maps/ne_10m_airports_major.geojson`;

export interface TacticalAirportsProps {
  dataUrl?: string;
}

export const TacticalAirports: React.FC<TacticalAirportsProps> = ({ dataUrl = AIRPORT_DATA_URL }) => {
  const [airports, setAirports] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTacticalGeoJson(dataUrl)
      .then(data => {
        if (!cancelled) setAirports(data);
      })
      .catch(() => {
        if (!cancelled) setAirports(null);
      });

    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  return (
    <Pane
      name="tacticalAirportLayer"
      className="tactical-airport-layer"
      style={{ zIndex: 300, pointerEvents: 'none' }}
    >
      {airports && (
        <GeoJSON
          data={airports}
          interactive={false}
          pointToLayer={(_feature, latlng) => L.circleMarker(latlng, {
            radius: 3,
            color: '#94a3b8',
            fillColor: '#64748b',
            fillOpacity: 0.9,
            weight: 1,
            className: 'tactical-airport-point',
            interactive: false,
          })}
        />
      )}
    </Pane>
  );
};
