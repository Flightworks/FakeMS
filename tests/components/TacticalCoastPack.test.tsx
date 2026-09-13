import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TacticalCoastPack } from '../../components/TacticalCoastPack';

vi.mock('react-leaflet', () => ({
  Pane: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { name?: string }>(
    ({ children, className, style, ...attributes }, ref) => (
      <div ref={ref} className={className} style={style} {...attributes}>{children}</div>
    ),
  ),
  GeoJSON: ({ data, style, interactive }: { data: { features: unknown[] }; style?: unknown; interactive?: boolean }) => (
    <div
      data-testid="coast-geojson"
      data-feature-count={String(data.features.length)}
      data-style={JSON.stringify(style)}
      data-interactive={String(interactive)}
    />
  ),
}));

const lineAsset = (name: string, bbox: [number, number, number, number] = [4, 42, 5.65, 45]) => ({
  type: 'FeatureCollection',
  bbox,
  features: [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [[bbox[0] + 0.1, 43], [bbox[0] + 0.2, 43.1]] },
  }],
  name,
});

const makeManifest = (assets: Array<Record<string, unknown>>) => ({
  ...manifest,
  assets,
});

const manifest = {
  schema: 'fakems.coastal-pack',
  schema_version: 1,
  pack_version: 'test',
  generated_at: '2026-09-13T00:00:00Z',
  crs: 'WGS84',
  bbox: [4, 42, 8, 45],
  assets: [{
    id: 'declared-west',
    path: 'renamed-west.geojson',
    sector: 'west',
    lod: 'full',
    bbox: [4, 42, 5.65, 45],
  }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TacticalCoastPack', () => {
  it('loads the manifest-declared local LineString sector without an opaque mask', async () => {
    const timings: Array<{ kind: string; durationMs: number; assetIds: readonly string[] }> = [];
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/maps/declared/manifest.json') {
        return { ok: true, json: async () => manifest } as Response;
      }
      if (url === '/maps/declared/renamed-west.geojson') {
        return { ok: true, json: async () => lineAsset('declared-west') } as Response;
      }
      throw new Error(`unexpected URL ${url}`);
    });

    render(
      <TacticalCoastPack
        manifestUrl="/maps/declared/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
        onLoadTiming={timing => timings.push(timing)}
      />,
    );

    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    expect(pane).toBeInTheDocument();
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'loaded'));
    const leafletPane = document.querySelector('.tactical-coast-pack-pane') as HTMLElement;
    expect(leafletPane).toHaveClass('tactical-coast-pack');
    expect(leafletPane).toHaveAttribute('data-coast-state', 'loaded');
    expect(pane).toHaveStyle({ pointerEvents: 'none' });
    expect(pane).toHaveAttribute('data-coast-sector-ids', 'declared-west');
    expect(pane).toHaveAttribute('data-coast-feature-count', '1');
    expect(screen.getByTestId('coast-geojson')).toHaveAttribute('data-interactive', 'false');
    expect(JSON.parse(screen.getByTestId('coast-geojson').getAttribute('data-style') ?? '{}')).toMatchObject({
      fill: false,
      fillOpacity: 0,
    });
    expect(pane).not.toHaveAttribute('data-coast-mask');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/maps/declared/manifest.json',
      '/maps/declared/renamed-west.geojson',
    ]);
    expect(timings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'manifest', durationMs: expect.any(Number), assetIds: [] }),
      expect.objectContaining({ kind: 'selection', durationMs: expect.any(Number), assetIds: ['declared-west'] }),
    ]));
  });

  it('loads every manifest-declared boundary sector in deterministic order', async () => {
    const boundaryManifest = makeManifest([
      { id: 'east', path: 'east-renamed.geojson', sector: 'east', lod: 'full', bbox: [5.65, 42, 8, 45] },
      { id: 'west', path: 'west-renamed.geojson', sector: 'west', lod: 'full', bbox: [4, 42, 5.65, 45] },
    ]);
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/maps/boundary/manifest.json') {
        return { ok: true, json: async () => boundaryManifest } as Response;
      }
      if (url === '/maps/boundary/west-renamed.geojson') {
        return { ok: true, json: async () => lineAsset('west', [4, 42, 5.65, 45]) } as Response;
      }
      if (url === '/maps/boundary/east-renamed.geojson') {
        return { ok: true, json: async () => lineAsset('east', [5.65, 42, 8, 45]) } as Response;
      }
      throw new Error(`unexpected URL ${url}`);
    });

    render(
      <TacticalCoastPack
        manifestUrl="/maps/boundary/manifest.json"
        center={{ lat: 43, lon: 5.65 }}
        viewport={[5.65, 42.9, 5.65, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );

    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'loaded'));
    expect(pane).toHaveAttribute('data-coast-sector-ids', 'west,east');
    expect(pane).toHaveAttribute('data-coast-feature-count', '2');
    expect([...document.querySelectorAll('[data-coast-sector-id]')].map(node => node.getAttribute('data-coast-sector-id')))
      .toEqual(['west', 'east']);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/maps/boundary/manifest.json',
      '/maps/boundary/west-renamed.geojson',
      '/maps/boundary/east-renamed.geojson',
    ]);
  });

  it('keeps the last valid selection visible while a replacement is pending or rejected', async () => {
    const retentionManifest = makeManifest([
      { id: 'west', path: 'west-renamed.geojson', sector: 'west', lod: 'full', bbox: [4, 42, 5.65, 45] },
      { id: 'east', path: 'east-renamed.geojson', sector: 'east', lod: 'full', bbox: [5.65, 42, 8, 45] },
    ]);
    let rejectEast: ((error: Error) => void) | undefined;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/maps/retention/manifest.json') {
        return { ok: true, json: async () => retentionManifest } as Response;
      }
      if (url === '/maps/retention/west-renamed.geojson') {
        return { ok: true, json: async () => lineAsset('west', [4, 42, 5.65, 45]) } as Response;
      }
      if (url === '/maps/retention/east-renamed.geojson') {
        return new Promise<Response>((_resolve, reject) => {
          rejectEast = reject;
        });
      }
      throw new Error(`unexpected URL ${url}`);
    });

    const result = render(
      <TacticalCoastPack
        manifestUrl="/maps/retention/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'loaded'));
    expect(pane).toHaveAttribute('data-coast-sector-ids', 'west');

    result.rerender(
      <TacticalCoastPack
        manifestUrl="/maps/retention/manifest.json"
        center={{ lat: 43, lon: 6.2 }}
        viewport={[6, 42.9, 6.4, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/maps/retention/east-renamed.geojson'));
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'pending'));
    expect(pane).toHaveAttribute('data-coast-sector-ids', 'west');
    expect(screen.getByTestId('coast-geojson')).toBeInTheDocument();

    await act(async () => {
      rejectEast?.(new Error('replacement offline'));
    });
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'loaded'));
    expect(pane).toHaveAttribute('data-coast-sector-ids', 'west');
    expect(pane).toHaveAttribute('data-coast-pending-sector-ids', '');
    expect(pane).not.toHaveAttribute('data-coast-mask');
  });

  it('ignores a canceled replacement even when its request resolves later', async () => {
    const cancellationManifest = makeManifest([
      { id: 'west-cancel', path: 'west-cancel.geojson', sector: 'west', lod: 'full', bbox: [4, 42, 5.65, 45] },
      { id: 'east-cancel', path: 'east-cancel.geojson', sector: 'east', lod: 'full', bbox: [5.65, 42, 8, 45] },
    ]);
    let resolveEast: ((response: Response) => void) | undefined;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/maps/cancel/manifest.json') return { ok: true, json: async () => cancellationManifest } as Response;
      if (url === '/maps/cancel/west-cancel.geojson') {
        return { ok: true, json: async () => lineAsset('west-cancel', [4, 42, 5.65, 45]) } as Response;
      }
      if (url === '/maps/cancel/east-cancel.geojson') {
        return new Promise<Response>(resolve => {
          resolveEast = resolve;
        });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    const result = render(
      <TacticalCoastPack
        manifestUrl="/maps/cancel/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'loaded'));

    result.rerender(
      <TacticalCoastPack
        manifestUrl="/maps/cancel/manifest.json"
        center={{ lat: 43, lon: 6.2 }}
        viewport={[6, 42.9, 6.4, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/maps/cancel/east-cancel.geojson'));
    result.rerender(
      <TacticalCoastPack
        manifestUrl="/maps/cancel/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-sector-ids', 'west-cancel'));

    await act(async () => {
      resolveEast?.({ ok: true, json: async () => lineAsset('east-cancel', [5.65, 42, 8, 45]) } as Response);
    });
    expect(pane).toHaveAttribute('data-coast-sector-ids', 'west-cancel');
    expect(pane).not.toHaveAttribute('data-coast-mask');
  });

  it('accepts a relative local manifest path and resolves its declared asset beside it', async () => {
    const relativeManifest = makeManifest([{
      id: 'relative-west',
      path: 'renamed-west.geojson',
      sector: 'west',
      lod: 'full',
      bbox: [4, 42, 5.65, 45],
    }]);
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'maps/relative/manifest.json') return { ok: true, json: async () => relativeManifest } as Response;
      if (url === 'maps/relative/renamed-west.geojson') {
        return { ok: true, json: async () => lineAsset('relative-west') } as Response;
      }
      throw new Error(`unexpected URL ${url}`);
    });

    render(
      <TacticalCoastPack
        manifestUrl="maps/relative/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'loaded'));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'maps/relative/manifest.json',
      'maps/relative/renamed-west.geojson',
    ]);
  });

  it('renders only a non-geometric fallback for an unavailable or non-local manifest', async () => {
    const externalFetch = vi.spyOn(global, 'fetch');
    const result = render(
      <TacticalCoastPack
        manifestUrl="https://example.test/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'fallback'));
    expect(externalFetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('coast-geojson')).not.toBeInTheDocument();
    expect(pane).not.toHaveAttribute('data-coast-mask');

    externalFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    result.rerender(
      <TacticalCoastPack
        manifestUrl="/maps/malformed/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );

    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'fallback'));
    expect(screen.queryByTestId('coast-geojson')).not.toBeInTheDocument();
  });

  it('keeps fallback-only output for an empty selected result or malformed asset', async () => {
    const malformedManifest = makeManifest([{
      id: 'malformed',
      path: 'malformed.geojson',
      sector: 'west',
      lod: 'full',
      bbox: [4, 42, 5.65, 45],
    }]);
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/maps/malformed-asset/manifest.json') {
        return { ok: true, json: async () => malformedManifest } as Response;
      }
      if (url === '/maps/malformed-asset/malformed.geojson') {
        return {
          ok: true,
          json: async () => ({ type: 'FeatureCollection', features: [] }),
        } as Response;
      }
      throw new Error(`unexpected URL ${url}`);
    });
    const result = render(
      <TacticalCoastPack
        manifestUrl="/maps/malformed-asset/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/maps/malformed-asset/malformed.geojson'));
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'fallback'));
    expect(screen.queryByTestId('coast-geojson')).not.toBeInTheDocument();
    expect(pane).not.toHaveAttribute('data-coast-mask');

    result.rerender(
      <TacticalCoastPack
        manifestUrl="/maps/malformed-asset/manifest.json"
        center={{ lat: 43, lon: 9 }}
        viewport={[8.9, 42.9, 9.1, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'fallback'));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('.geojson'))).toHaveLength(1);
  });

  it('limits concurrent sector loads to two assets', async () => {
    const concurrencyManifest = makeManifest([
      { id: 'sector-a', path: 'sector-a.geojson', sector: 'west', lod: 'full', bbox: [4, 42, 5.65, 45] },
      { id: 'sector-b', path: 'sector-b.geojson', sector: 'west', lod: 'full', bbox: [4, 42, 5.65, 45] },
      { id: 'sector-c', path: 'sector-c.geojson', sector: 'west', lod: 'full', bbox: [4, 42, 5.65, 45] },
    ]);
    const resolvers = new Map<string, (response: Response) => void>();
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/maps/concurrency/manifest.json') {
        return { ok: true, json: async () => concurrencyManifest } as Response;
      }
      if (/^\/maps\/concurrency\/sector-[abc]\.geojson$/.test(url)) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise<Response>(resolve => {
          resolvers.set(url, response => {
            inFlight -= 1;
            resolve(response);
          });
        });
      }
      throw new Error(`unexpected URL ${url}`);
    });

    render(
      <TacticalCoastPack
        manifestUrl="/maps/concurrency/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={0}
      />,
    );
    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('.geojson'))).toHaveLength(2));
    expect(maxInFlight).toBeLessThanOrEqual(2);

    await act(async () => {
      resolvers.get('/maps/concurrency/sector-a.geojson')?.({ ok: true, json: async () => lineAsset('a') } as Response);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/maps/concurrency/sector-c.geojson'));
    expect(maxInFlight).toBeLessThanOrEqual(2);
    await act(async () => {
      resolvers.get('/maps/concurrency/sector-b.geojson')?.({ ok: true, json: async () => lineAsset('b') } as Response);
      resolvers.get('/maps/concurrency/sector-c.geojson')?.({ ok: true, json: async () => lineAsset('c') } as Response);
    });
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'loaded'));
  });

  it('does not refetch when a stable pan remains within the same selected sector', async () => {
    const panManifest = makeManifest([{
      id: 'pan-west',
      path: 'pan-west.geojson',
      sector: 'west',
      lod: 'full',
      bbox: [4, 42, 5.65, 45],
    }]);
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/maps/pan/manifest.json') return { ok: true, json: async () => panManifest } as Response;
      if (url === '/maps/pan/pan-west.geojson') {
        return { ok: true, json: async () => lineAsset('pan-west') } as Response;
      }
      throw new Error(`unexpected URL ${url}`);
    });
    const result = render(
      <TacticalCoastPack
        manifestUrl="/maps/pan/manifest.json"
        center={{ lat: 43, lon: 5.1 }}
        viewport={[5, 42.9, 5.2, 43.1]}
        zoom={13}
        debounceMs={10}
      />,
    );
    const pane = document.querySelector('.tactical-coast-pack') as HTMLElement;
    await waitFor(() => expect(pane).toHaveAttribute('data-coast-state', 'loaded'));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    result.rerender(
      <TacticalCoastPack
        manifestUrl="/maps/pan/manifest.json"
        center={{ lat: 43.2, lon: 5.3 }}
        viewport={[5.2, 43.1, 5.4, 43.3]}
        zoom={13}
        debounceMs={10}
      />,
    );
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pane).toHaveAttribute('data-coast-sector-ids', 'pan-west');
  });

  it('deduplicates the manifest and asset requests for concurrent pack instances', async () => {
    const dedupeManifest = makeManifest([{
      id: 'dedupe-west',
      path: 'dedupe-west.geojson',
      sector: 'west',
      lod: 'full',
      bbox: [4, 42, 5.65, 45],
    }]);
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/maps/dedupe/manifest.json') {
        return { ok: true, json: async () => dedupeManifest } as Response;
      }
      if (url === '/maps/dedupe/dedupe-west.geojson') {
        return { ok: true, json: async () => lineAsset('dedupe-west') } as Response;
      }
      throw new Error(`unexpected URL ${url}`);
    });
    const props = {
      manifestUrl: '/maps/dedupe/manifest.json',
      center: { lat: 43, lon: 5.1 },
      viewport: [5, 42.9, 5.2, 43.1] as [number, number, number, number],
      zoom: 13,
      debounceMs: 0,
    };

    render(<TacticalCoastPack {...props} />);
    render(<TacticalCoastPack {...props} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/maps/dedupe/dedupe-west.geojson'));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/maps/dedupe/manifest.json',
      '/maps/dedupe/dedupe-west.geojson',
    ]);
  });
});
