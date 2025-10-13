import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseBetclicText } from './index';

describe('parseBetclicText', () => {
	it('extracts tournaments and hands from sample', () => {
		const raw = readFileSync(__dirname + '/fixtures/sample1.txt', 'utf-8');
		const res = parseBetclicText(raw);
		expect(res.tournaments.length).toBeGreaterThan(0);
		const totalHands = res.tournaments.reduce((acc, t) => acc + t.hands.length, 0);
		expect(totalHands).toBeGreaterThan(0);
	});

    it('captures players, actions and total pot on at least one hand', () => {
        const raw = readFileSync(__dirname + '/fixtures/sample1.txt', 'utf-8');
        const res = parseBetclicText(raw);
        const some = res.tournaments.flatMap(t => t.hands).find(h => {
            const playersOk = Array.isArray(h.players) && h.players.length >= 2;
            const actionsOk = Array.isArray(h.actions) && h.actions.length >= 1;
            const potOk = (h.totalPotCents ?? 0) > 0;
            return playersOk && actionsOk && potOk;
        });
        expect(some, 'expected at least one hand with players, actions and total pot').toBeTruthy();
    });
});
