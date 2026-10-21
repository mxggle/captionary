import { describe, expect, it } from 'vitest';
import { placeCard } from './LookupCard';

const bounds = { left: 0, top: 0, width: 1280, height: 720 };
const word = (top: number) => ({ left: 600, top, width: 60, height: 30 });

describe('placeCard', () => {
  it('holds a card above the caption line by its bottom edge', () => {
    const line = word(620);
    const p = placeCard(360, { anchor: line, avoid: line, bounds });
    expect(p.growsUp).toBe(true);
    expect(p.style.bottom).toBe(720 - 620 + 10);
    expect(p.style.top).toBeUndefined();
  });

  it('holds a card below the caption line by its top edge', () => {
    const line = word(80);
    const p = placeCard(360, { anchor: line, avoid: line, bounds });
    expect(p.growsUp).toBeFalsy();
    expect(p.style.top).toBe(80 + 30 + 10);
  });

  it('hangs the card from the top of a player too small to fit it beside the line', () => {
    const small = { left: 0, top: 0, width: 400, height: 225 };
    const line = { left: 180, top: 110, width: 40, height: 24 };
    const p = placeCard(330, { anchor: line, avoid: line, bounds: small });
    expect(p.style.top).toBe(8);
    expect(p.maxHeight).toBe(225 - 16);
    expect(p.arrow).toBeUndefined();
  });

  it('never lets a card above the line run past the top of the player', () => {
    const small = { left: 0, top: 0, width: 640, height: 360 };
    const line = word(250);
    const p = placeCard(330, { anchor: line, avoid: line, bounds: small });
    const top = small.height - (p.style.bottom as number) - p.maxHeight;
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it('holds a card beside the drawer by its top edge', () => {
    const p = placeCard(360, { anchor: word(300), avoid: word(300), bounds, side: { left: 900, top: 0, width: 380, height: 720 } });
    expect(p.growsUp).toBeFalsy();
    expect(p.style.top).toBeDefined();
  });
});
