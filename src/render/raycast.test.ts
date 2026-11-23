import { describe, expect, it } from 'vitest';
import type { Camera } from './raycast';
import { cameraRay, castRay, hitBounds, hitRect, project } from './raycast';

const box = { x: 100, y: 100, w: 50, h: 50 };

describe('hitRect', () => {
  it('finds the near face and the spot along it', () => {
    const hit = hitRect({ x: 0, y: 120 }, { x: 1, y: 0 }, box, 3);
    expect(hit).toEqual({ dist: 100, face: 'x', u: 20, wall: 3 });
  });

  it('reports top/bottom faces as y', () => {
    const hit = hitRect({ x: 110, y: 0 }, { x: 0, y: 2 }, box, 0);
    expect(hit).toEqual({ dist: 50, face: 'y', u: 10, wall: 0 });
  });

  it('misses beside, behind, and from inside', () => {
    expect(hitRect({ x: 0, y: 50 }, { x: 1, y: 0 }, box, 0)).toBeNull();
    expect(hitRect({ x: 200, y: 120 }, { x: 1, y: 0 }, box, 0)).toBeNull();
    expect(hitRect({ x: 120, y: 120 }, { x: 1, y: 0 }, box, 0)).toBeNull();
  });
});

describe('castRay', () => {
  it('hits the outer wall when nothing is in the way', () => {
    expect(hitBounds({ x: 10, y: 10 }, { x: -1, y: 0 }, 300, 200)).toEqual({ dist: 10, face: 'x', u: 10, wall: -1 });
    expect(castRay({ x: 10, y: 10 }, { x: 0, y: 1 }, [box], 300, 200).dist).toBe(190);
  });

  it('takes the nearest boulder', () => {
    const far = { x: 200, y: 100, w: 20, h: 50 };
    expect(castRay({ x: 0, y: 120 }, { x: 1, y: 0 }, [far, box], 300, 200).wall).toBe(1);
  });
});

describe('camera', () => {
  const cam: Camera = { pos: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, plane: 0.5 };

  it('sweeps rays from left (up the screen) to right (down)', () => {
    expect(cameraRay(cam, -1)).toEqual({ x: 1, y: -0.5 });
    expect(cameraRay(cam, 1)).toEqual({ x: 1, y: 0.5 });
  });

  it('projects points so that camera rays and projection agree', () => {
    expect(project(cam, { x: 100, y: 50 })).toEqual({ depth: 100, camX: 1 });
    expect(project(cam, { x: 100, y: 0 }).camX).toBe(0);
    expect(project(cam, { x: -10, y: 0 }).depth).toBeLessThan(0);
  });
});
