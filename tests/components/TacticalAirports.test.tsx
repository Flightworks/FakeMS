import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { TacticalAirports } from '../../components/TacticalAirports';

vi.mock('react-leaflet', () => ({
  Pane: ({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <div className={className} style={style} data-testid="tactical-airport-pane">{children}</div>
  ),
  GeoJSON: ({ data, pointToLayer, interactive }: { data: FeatureCollection; pointToLayer?: unknown; interactive?: boolean }) => (
    <div
      data-testid="tactical-airports-geojson"
      data-feature-count={String(data.features.length)}
      data-has-point-layer={String(Boolean(pointToLayer))}
      data-interactive={String(interactive)}
    />
  ),
}));

const airports: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: 'TLN', iata_code: 'TLN', scalerank: 4 },
    geometry: { type: 'Point', coordinates: [6.146, 43.0973] },
  }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TacticalAirports', () => {
  it('loads major airports as a non-interactive point layer without labels', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => airports,
    } as Response);

    render(<TacticalAirports dataUrl="/maps/test-airports.json" />);

    const geoJson = await screen.findByTestId('tactical-airports-geojson');
    expect(fetchMock).toHaveBeenCalledWith('/maps/test-airports.json');
    expect(geoJson).toHaveAttribute('data-feature-count', '1');
    expect(geoJson).toHaveAttribute('data-has-point-layer', 'true');
    expect(geoJson).toHaveAttribute('data-interactive', 'false');
    expect(screen.getByTestId('tactical-airport-pane')).toHaveClass('tactical-airport-layer');
    expect(screen.getByTestId('tactical-airport-pane')).toHaveStyle({ pointerEvents: 'none' });
    expect(screen.queryByText('TLN')).not.toBeInTheDocument();
  });

  it('fails closed without adding a visible layer when data is unavailable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    render(<TacticalAirports dataUrl="/maps/missing-airports.json" />);

    await waitFor(() => expect(screen.queryByTestId('tactical-airports-geojson')).not.toBeInTheDocument());
    expect(screen.getByTestId('tactical-airport-pane')).toBeInTheDocument();
  });
});
