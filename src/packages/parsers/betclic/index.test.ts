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

	it('marque un post de small blind all-in comme all-in', () => {
		const raw = `
*** HEADER ***
Game ID: test-game
*** PLAYERS ***
Seat 1: Hero (10) [SB Hero]
Seat 2: Villain (1000) [BB]
*** HOLE CARDS ***
Hero: [As 2s]
Villain: [Kd Qh]
*** PRE-FLOP ***
00:00:00 - Hero: Posts SB 10 and is all-in
00:00:01 - Villain: Posts BB 20
00:00:02 - Villain: Calls 10
*** FLOP *** [Ah Kd Qh]
*** SUMMARY ***
Hero wins main pot of 20
Villain wins 1st side pot of 10
`;
		const res = parseBetclicText(raw);
		const firstTournament = res.tournaments[0];
		expect(firstTournament).toBeTruthy();
		const hand = firstTournament?.hands[0];
		expect(hand).toBeTruthy();
		const actions = hand?.actions ?? [];
		const sbAction = actions.find((a) => a.seat === 1);
		expect(sbAction?.isAllIn).toBe(true);
		expect(sbAction?.type).toBe('push');
		expect(sbAction?.sizeCents).toBe(10);
	});
});
