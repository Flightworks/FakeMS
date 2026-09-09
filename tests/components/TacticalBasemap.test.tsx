import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { TacticalBasemap, TACTICAL_BASEMAP_STYLE } from '../../components/TacticalBasemap';

vi.mock('react-leaflet', () => ({
  Pane: ({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <div className={className} style={style} data-testid="tactical-pane">{children}</div>
  ),
  GeoJSON: ({ data, style }: { data: FeatureCollection; style?: unknown }) => (
    <div
      data-testid="tactical-basemap-geojson"
      data-feature-count={String(data.features.length)}
      data-style={JSON.stringify(style)}
    />
  ),
}));

const land: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TacticalBasemap', () => {
  it('loads one local FeatureCollection with the tactical land style', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => land,
    } as Response);

    render(<TacticalBasemap dataUrl="/maps/test-land.json" />);

    const geoJson = await screen.findByTestId('tactical-basemap-geojson');
    expect(fetchMock).toHaveBeenCalledWith('/maps/test-land.json');
    expect(geoJson).toHaveAttribute('data-feature-count', '1');
    expect(JSON.parse(geoJson.getAttribute('data-style') ?? '{}')).toMatchObject({
      fillColor: TACTICAL_BASEMAP_STYLE.landFill,
      color: TACTICAL_BASEMAP_STYLE.coastline,
      fillOpacity: 1,
      opacity: TACTICAL_BASEMAP_STYLE.coastlineOpacity,
    });
    expect(screen.getByTestId('tactical-pane')).toHaveClass('tactical-basemap-land');
    expect(screen.getByTestId('tactical-pane')).toHaveStyle({ pointerEvents: 'none' });
  });

  it('keeps the ocean fallback when local data cannot be loaded', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    render(<TacticalBasemap dataUrl="/maps/missing-land.json" />);

    await waitFor(() => expect(screen.queryByTestId('tactical-basemap-geojson')).not.toBeInTheDocument());
    expect(screen.getByTestId('tactical-pane')).toBeInTheDocument();
  });
});
