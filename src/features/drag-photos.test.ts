import { describe, expect, it } from 'vitest';
import { restingPoint } from './drag-photos';

describe('restingPoint (dragging photos in the timeline)', () => {
  const points = [0, 300, 600, 900];

  it('goes back after a short drag', () => {
    expect(restingPoint(points, 300, 340, false)).toBe(300);
    expect(restingPoint(points, 300, 250, false)).toBe(300);
  });

  it('moves at least one photo in the direction of a longer drag', () => {
    expect(restingPoint(points, 300, 380, true)).toBe(600);
    expect(restingPoint(points, 300, 220, true)).toBe(0);
  });

  it('rests on the nearest photo after a drag across several', () => {
    expect(restingPoint(points, 0, 830, true)).toBe(900);
    expect(restingPoint(points, 900, 280, true)).toBe(300);
  });

  it('stays at the ends when there is nothing further', () => {
    expect(restingPoint(points, 900, 900, true)).toBe(900);
    expect(restingPoint(points, 0, 0, true)).toBe(0);
  });
});
