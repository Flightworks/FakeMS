import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import {
  TacticalCoastalDetail,
  TOULON_COASTAL_DETAIL_BOUNDS,
  TACTICAL_COASTAL_DETAIL_STYLE,
} from '../../components/TacticalCoastalDetail';

vi.mock('react-leaflet', () => ({
  Pane: ({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <div className={className} style={style} data-testid="coastal-detail-pane">{children}</div>
  ),
  Rectangle: ({ bounds, pathOptions, interactive }: { bounds: unknown; pathOptions: unknown; interactive?: boolean }) => (
    <div data-testid="coastal-detail-mask" data-bounds={JSON.stringify(bounds)} data-style={JSON.stringify(pathOptions)} data-interactive={String(interactive)} />
  ),
  GeoJSON: ({ data, style, interactive }: { data: FeatureCollection; style?: unknown; interactive?: boolean }) => (
    <div data-testid="coastal-detail-geojson" data-feature-count={String(data.features.length)} data-style={JSON.stringify(style)} data-interactive={String(interactive)} />
  ),
}));

const land: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[5, 43], [6, 43], [6, 44], [5, 43]]] },
  }],
};

afterEach(() => vi.restoreAllMocks());

describe('TacticalCoastalDetail', () => {
  it('masks the coarse local area then renders clipped 1:10m land without interactions', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => land } as Response);

    render(<TacticalCoastalDetail dataUrl="/maps/test-coast.json" />);

    const detail = await screen.findByTestId('coastal-detail-geojson');
    expect(fetchMock).toHaveBeenCalledWith('/maps/test-coast.json');
    expect(screen.getByTestId('coastal-detail-pane')).toHaveClass('tactical-coastal-detail');
    expect(screen.getByTestId('coastal-detail-mask')).toHaveAttribute('data-bounds', JSON.stringify(TOULON_COASTAL_DETAIL_BOUNDS));
    expect(screen.getByTestId('coastal-detail-mask')).toHaveAttribute('data-interactive', 'false');
    expect(screen.getByTestId('coastal-detail-mask')).toHaveAttribute('data-style', expect.stringContaining(TACTICAL_COASTAL_DETAIL_STYLE.ocean));
    expect(detail).toHaveAttribute('data-interactive', 'false');
    expect(JSON.parse(detail.getAttribute('data-style') ?? '{}')).toMatchObject({
      fillColor: TACTICAL_COASTAL_DETAIL_STYLE.landFill,
      color: TACTICAL_COASTAL_DETAIL_STYLE.coastline,
      weight: TACTICAL_COASTAL_DETAIL_STYLE.coastlineWeight,
    });
  });

  it('renders no coastal detail pane or mask after the detail request is rejected', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    render(<TacticalCoastalDetail dataUrl="/maps/rejected-coast.json" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/maps/rejected-coast.json'));
    await waitFor(() => {
      expect(screen.queryByTestId('coastal-detail-pane')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coastal-detail-mask')).not.toBeInTheDocument();
    });
  });

  it('renders no coastal detail pane while a canceled request is superseded', async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(() => new Promise<Response>(resolve => {
      resolvers.push(resolve);
    }));

    const { rerender } = render(<TacticalCoastalDetail dataUrl="/maps/cancelled-coast.json" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<TacticalCoastalDetail dataUrl="/maps/replacement-coast.json" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolvers[0]({ ok: true, json: async () => land } as Response);
    });

    expect(screen.queryByTestId('coastal-detail-pane')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coastal-detail-mask')).not.toBeInTheDocument();
  });

  it('removes an already-rendered detail pane while replacement data is pending', async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(() => new Promise<Response>(resolve => {
      resolvers.push(resolve);
    }));

    const { rerender } = render(<TacticalCoastalDetail dataUrl="/maps/initial-coast.json" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolvers[0]({ ok: true, json: async () => land } as Response);
    });
    expect(await screen.findByTestId('coastal-detail-geojson')).toBeInTheDocument();

    rerender(<TacticalCoastalDetail dataUrl="/maps/replacement-pending-coast.json" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(screen.queryByTestId('coastal-detail-pane')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coastal-detail-mask')).not.toBeInTheDocument();
  });

  it('renders no coastal detail pane or mask for an empty FeatureCollection', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    } as Response);

    render(<TacticalCoastalDetail dataUrl="/maps/empty-coast.json" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/maps/empty-coast.json'));
    await waitFor(() => {
      expect(screen.queryByTestId('coastal-detail-pane')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coastal-detail-mask')).not.toBeInTheDocument();
    });
  });
});
