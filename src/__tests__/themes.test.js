import { describe, it, expect } from 'vitest';
import { themes } from '../constants/themes.js';

const REQUIRED_CSS_PROPS = [
  '--bg-color',
  '--text-color',
  '--accent-color',
  '--toolbar-bg',
  '--toolbar-border',
  '--editor-bg',
  '--editor-shadow',
  '--page-bg',
];

describe('themes', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(themes)).toBe(true);
    expect(themes.length).toBeGreaterThan(0);
  });

  it('each theme has required fields (id, name, colors)', () => {
    for (const theme of themes) {
      expect(theme).toHaveProperty('id');
      expect(theme).toHaveProperty('name');
      expect(theme).toHaveProperty('colors');
      expect(typeof theme.id).toBe('string');
      expect(typeof theme.name).toBe('string');
      expect(typeof theme.colors).toBe('object');
    }
  });

  it('each theme has all required CSS custom properties', () => {
    for (const theme of themes) {
      for (const prop of REQUIRED_CSS_PROPS) {
        expect(theme.colors).toHaveProperty(prop);
        expect(typeof theme.colors[prop]).toBe('string');
        expect(theme.colors[prop].length).toBeGreaterThan(0);
      }
    }
  });

  it('all theme IDs are unique', () => {
    const ids = themes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('first theme is light (default)', () => {
    expect(themes[0].id).toBe('light');
  });

  it('color values are valid CSS color strings', () => {
    const cssColorPattern = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/;
    for (const theme of themes) {
      for (const [key, value] of Object.entries(theme.colors)) {
        if (key !== '--editor-shadow') {
          expect(value).toMatch(cssColorPattern);
        }
      }
    }
  });
});
