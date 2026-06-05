import { describe, it, expect } from 'vitest';
import { generateRoomCode, ROOM_CODE_ALPHABET } from './roomCode.js';
import { ROOM_CODE_LENGTH } from './constants.js';

describe('generateRoomCode', () => {
  it('has the configured length and uses only the safe alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });
  it('is reasonably unique across many draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateRoomCode());
    expect(seen.size).toBeGreaterThan(150);
  });
});
