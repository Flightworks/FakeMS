import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { DocumentViewer } from '../../components/DocumentViewer';

// Mock the raw md imports
vi.mock('../../optask.md?raw', () => ({
  default: `# OPTASK Report

Welcome.

## Quick Links
- [OPTASK Surface](#optask-surface)
- [OPTASK Comms](#optask-comms)

## OPTASK Surface

Surface info here.

## OPTASK Comms

Comms info here.
`
}));

// Mock other assets if loaded or needed
vi.mock('lucide-react', () => ({
  X: () => <div data-testid="icon-x" />,
  FileText: () => <div data-testid="icon-file-text" />,
  Code: () => <div data-testid="icon-code" />
}));

describe('DocumentViewer Component', () => {
  beforeEach(() => {
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders document markdown and assigns correct IDs to headers', async () => {
    render(<DocumentViewer filename="optask.md" onClose={vi.fn()} />);

    // Wait for the content to be loaded and rendered
    await waitFor(() => {
      expect(screen.getByText('OPTASK Report')).toBeInTheDocument();
    });

    // Check header IDs
    const h1 = screen.getByRole('heading', { level: 1, name: 'OPTASK Report' });
    expect(h1).toHaveAttribute('id', 'optask-report');

    const h2Surface = screen.getByRole('heading', { level: 2, name: 'OPTASK Surface' });
    expect(h2Surface).toHaveAttribute('id', 'optask-surface');

    const h2Comms = screen.getByRole('heading', { level: 2, name: 'OPTASK Comms' });
    expect(h2Comms).toHaveAttribute('id', 'optask-comms');
  });

  it('scrolls to heading when clicking internal hash links', async () => {
    render(<DocumentViewer filename="optask.md" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('OPTASK Report')).toBeInTheDocument();
    });

    const scrollIntoViewSpy = vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView');

    // Find the link to OPTASK Surface
    const link = screen.getByRole('link', { name: 'OPTASK Surface' });
    expect(link).toHaveAttribute('href', '#optask-surface');

    // Click the link
    fireEvent.click(link);

    // It should have found the element and called scrollIntoView
    expect(scrollIntoViewSpy).toHaveBeenCalled();
  });
});
