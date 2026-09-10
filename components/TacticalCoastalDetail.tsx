import React, { useEffect, useState } from 'react';
import { GeoJSON, Pane, Rectangle } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import { loadTacticalGeoJson } from './tacticalMapData';

const COASTAL_DETAIL_DATA_URL = `${import.meta.env.BASE_URL}maps/ne_10m_land_toulon.geojson`;

// Wide enough to keep the local detail beyond the normal Toulon mission view.
export const TOULON_COASTAL_DETAIL_BOUNDS: [[number, number], [number, number]] = [[38, 0], [47, 14]];

export const TACTICAL_COASTAL_DETAIL_STYLE = {
  ocean: '#090d12',
  landFill: '#20272d',
  coastline: '#7b8791',
  coastlineOpacity: 0.9,
  coastlineWeight: 1.25,
} as const;

export interface TacticalCoastalDetailProps {
  dataUrl?: string;
}

export const TacticalCoastalDetail: React.FC<TacticalCoastalDetailProps> = ({ dataUrl = COASTAL_DETAIL_DATA_URL }) => {
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
      name="tacticalCoastalDetailLayer"
      className="tactical-coastal-detail"
      style={{ zIndex: 210, pointerEvents: 'none' }}
    >
      <Rectangle
        bounds={TOULON_COASTAL_DETAIL_BOUNDS}
        interactive={false}
        pathOptions={{ fillColor: TACTICAL_COASTAL_DETAIL_STYLE.ocean, fillOpacity: 1, stroke: false }}
      />
      {land && (
        <GeoJSON
          data={land}
          interactive={false}
          style={{
            fillColor: TACTICAL_COASTAL_DETAIL_STYLE.landFill,
            fillOpacity: 1,
            color: TACTICAL_COASTAL_DETAIL_STYLE.coastline,
            opacity: TACTICAL_COASTAL_DETAIL_STYLE.coastlineOpacity,
            weight: TACTICAL_COASTAL_DETAIL_STYLE.coastlineWeight,
          }}
        />
      )}
    </Pane>
  );
};
