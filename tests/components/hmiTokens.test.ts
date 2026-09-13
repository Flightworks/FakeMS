import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HMI_TOKENS } from '../../components/hmiTokens';

const pixels = (value: string): number => Number.parseFloat(value);
const css = readFileSync(resolve(process.cwd(), 'index.css'), 'utf8');

const hexRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16)) as [number, number, number];
};

const luminance = (hex: string): number => {
  const channels = hexRgb(hex).map(channel => channel / 255).map(channel => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (foreground: string, background: string): number => {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

describe('HMI readability tokens', () => {
  it('sets the primary value and action text at readable minimums', () => {
    expect(pixels(HMI_TOKENS.typography.primaryValue)).toBeGreaterThanOrEqual(18);
    expect(pixels(HMI_TOKENS.typography.action)).toBeGreaterThanOrEqual(14);
    expect(pixels(HMI_TOKENS.typography.qualification)).toBeGreaterThanOrEqual(14);
  });

  it('keeps exact token colors above the composed-surface contrast targets', () => {
    const panel = HMI_TOKENS.colors.surface.panel;
    for (const [name, color] of Object.entries(HMI_TOKENS.colors.text)) {
      expect(contrast(color, panel), `${name} on panel`).toBeGreaterThanOrEqual(4.5);
    }

    const states = Object.entries(HMI_TOKENS.colors.state);
    for (const [name, state] of states) {
      expect(contrast(state.foreground, state.background), `${name} state text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(state.indicator, panel), `${name} state indicator`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps unavailable and disabled states distinct from green success', () => {
    expect(HMI_TOKENS.colors.state.unavailable.indicator).not.toBe(HMI_TOKENS.colors.state.available.indicator);
    expect(HMI_TOKENS.colors.state.disabled.indicator).not.toBe(HMI_TOKENS.colors.state.available.indicator);
    expect(HMI_TOKENS.colors.state.unknown.indicator).not.toBe(HMI_TOKENS.colors.state.available.indicator);
  });

  it('publishes active-target, focus, spacing, and motion contracts', () => {
    expect(pixels(HMI_TOKENS.target.minWidth)).toBeGreaterThanOrEqual(48);
    expect(pixels(HMI_TOKENS.target.minHeight)).toBeGreaterThanOrEqual(48);
    expect(HMI_TOKENS.focus.ring).toContain(HMI_TOKENS.focus.ringColor);
    expect(pixels(HMI_TOKENS.focus.ringOffset)).toBeGreaterThanOrEqual(2);
    expect(HMI_TOKENS.spacing.inline).toBe('0.5rem');
    expect(HMI_TOKENS.spacing.row).toBe('0.75rem');
    expect(HMI_TOKENS.motion.reducedFallback).toBe('none');
  });

  it('wires the token values through CSS without dimming map symbols', () => {
    expect(css).toContain(`--hmi-font-primary-value: ${HMI_TOKENS.typography.primaryValue};`);
    expect(css).toContain(`--hmi-font-action: ${HMI_TOKENS.typography.action};`);
    expect(css).toContain(`--hmi-font-qualification: ${HMI_TOKENS.typography.qualification};`);
    expect(css).toContain(`--hmi-target-min-size: ${HMI_TOKENS.target.minSize};`);
    expect(css).toMatch(/\.hmi-focus-ring:focus-visible/);
    expect(css).toMatch(/\.hmi-active-target/);
    for (const state of ['available', 'partial', 'incomplete', 'ambiguous', 'unavailable', 'disabled', 'unknown']) {
      expect(css).toMatch(new RegExp(`\\.hmi-state-${state}\\b`));
    }
    expect(css).toContain('border-color: var(--hmi-state-unknown-indicator);');
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toContain('animation-duration: var(--hmi-motion-reduced-animation) !important');
    expect(css).toContain('transition-duration: var(--hmi-motion-reduced-transition) !important');
    expect(css).not.toMatch(/filter\s*:/);
  });
});
