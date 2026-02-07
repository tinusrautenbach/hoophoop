import { describe, it, expect } from 'vitest';
import { parsePlayerList } from '../roster';

describe('Roster Service', () => {
    it('should parse single player line', () => {
        const result = parsePlayerList("23 Jordan");
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ number: "23", name: "Jordan" });
    });

    it('should parse multiple players', () => {
        const result = parsePlayerList("23 Jordan\n33 Pippen");
        expect(result).toHaveLength(2);
        expect(result[1]).toEqual({ number: "33", name: "Pippen" });
    });

    it('should handle comma separation', () => {
        const result = parsePlayerList("23 Jordan, 33 Pippen");
        expect(result).toHaveLength(2);
    });
});
