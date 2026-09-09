import React, { useEffect, useState } from 'react';
import { GeoJSON, Pane } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import { loadTacticalGeoJson } from './tacticalMapData';

export const TACTICAL_BASEMAP_STYLE = {
  ocean: '#090d12',
  landFill: '#20272d',
  coastline: '#6b7680',
  coastlineOpacity: 0.8,
  coastlineWeight: 1,
} as const;

const LAND_DATA_URL = `${import.meta.env.BASE_URL}maps/ne_110m_land.geojson`;

export interface TacticalBasemapProps {
  dataUrl?: string;
}

export const TacticalBasemap: React.FC<TacticalBasemapProps> = ({ dataUrl = LAND_DATA_URL }) => {
  const [land, setLand] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTacticalGeoJson(dataUrl)
      .then(data => {
        if (!cancelled) setLand(data);
      })
      .catch(() => {
        if (!cancelled) setLand(null);
      });

    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  return (
    <Pane
      name="tacticalBasemapLayer"
      className="tactical-basemap-land"
      style={{ zIndex: 200, pointerEvents: 'none' }}
    >
      {land && (
        <GeoJSON
          data={land}
          interactive={false}

          style={{
            fillColor: TACTICAL_BASEMAP_STYLE.landFill,
            fillOpacity: 1,
            color: TACTICAL_BASEMAP_STYLE.coastline,
            opacity: TACTICAL_BASEMAP_STYLE.coastlineOpacity,
            weight: TACTICAL_BASEMAP_STYLE.coastlineWeight,
          }}
        />
      )}
    </Pane>
  );
};
