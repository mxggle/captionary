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

  it('holds a card beside the drawer by its top edge', () => {
    const p = placeCard(360, { anchor: word(300), avoid: word(300), bounds, side: { left: 900, top: 0, width: 380, height: 720 } });
    expect(p.growsUp).toBeFalsy();
    expect(p.style.top).toBeDefined();
  });
});
