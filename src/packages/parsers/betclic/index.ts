export type ParsedTournament = {
	gameId: string;
	startedAt: Date | null;
	buyInCents: number;
	rakeCents: number;
	prizePoolCents: number;
	prizeMultiplier: number;
	heroResultPosition: number | null;
	heroPrizeCents: number | null;
	profitCents: number | null;
	heroName?: string | null;
	hands: ParsedHand[];
};

export type ParsedHand = {
	handId: string | null;
	sbCents: number | null;
	bbCents: number | null;
	heroSeat: number | null;
	dealtCards: string | null;
	board: string | null;
	boardFlop?: string | null;
	boardTurn?: string | null;
	boardRiver?: string | null;
	winnerSeat: number | null;
	playedAt: Date | null;
	actions?: ParsedAction[];
	players?: ParsedPlayer[];
	totalPotCents?: number | null;
    mainPotCents?: number | null;
};

export type ParsedAction = {
	orderNo: number;
	street: 'preflop' | 'flop' | 'turn' | 'river';
	seat: number | null;
	type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'push';
	sizeCents: number | null;
	isAllIn: boolean;
};

export type ParsedResult = {
	tournaments: ParsedTournament[];
};

export type ParsedPlayer = {
	seat: number;
	name: string;
	startingStackCents: number | null;
	hole?: string | null;
	isHero?: boolean;
};

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Line-oriented tolerant parser extracting tournaments and basic hand info
export function parseBetclicText(raw: string): ParsedResult {
	const lines = raw.split(/\r?\n/);
	const tournamentsMap: Map<string, ParsedTournament> = new Map();
	let current: ParsedTournament | null = null;
	let inPlayers = false;
	let inHole = false;
	let inSummary = false;
	let heroName: string | null = null;
	let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
	let nameToSeat: Record<string, number> = {};
	let actionOrder = 0;
	let currentPlayers: ParsedPlayer[] = [];
	let pendingTotalPotCents: number | null = null;

	const pushCurrent = () => {
		if (current) {
			const key = current.gameId || `unknown-${Math.random()}`;
			const existing = tournamentsMap.get(key);
			if (!existing) {
				// Create aggregate entry
				tournamentsMap.set(key, { ...current, heroName });
			} else {
				// Merge
				existing.startedAt = existing.startedAt && current.startedAt ? (existing.startedAt < current.startedAt ? existing.startedAt : current.startedAt) : (existing.startedAt ?? current.startedAt ?? null);
				existing.buyInCents = current.buyInCents || existing.buyInCents;
				existing.rakeCents = current.rakeCents || existing.rakeCents;
				existing.prizePoolCents = current.prizePoolCents || existing.prizePoolCents;
				existing.prizeMultiplier = current.prizeMultiplier || existing.prizeMultiplier;
				existing.heroName = heroName || existing.heroName || null;
				if (current.heroResultPosition != null) existing.heroResultPosition = current.heroResultPosition;
				if (current.heroPrizeCents != null) existing.heroPrizeCents = current.heroPrizeCents;
				existing.hands.push(...current.hands);
			}
			current = null;
		}
		inPlayers = inHole = inSummary = false;
		nameToSeat = {};
		actionOrder = 0;
		currentStreet = 'preflop';
		currentPlayers = [];
		pendingTotalPotCents = null;
	};

	const parseMoney = (s: string): number => {
		const m = s.replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
		const v = parseFloat(m || '0');
		return Math.round(v * 100);
	};

	for (const line of lines) {
		if (line.startsWith('*** HEADER ***')) {
			pushCurrent();
			current = {
				gameId: '',
				startedAt: null,
				buyInCents: 0,
				rakeCents: 0,
				prizePoolCents: 0,
				prizeMultiplier: 1,
				heroResultPosition: null,
				heroPrizeCents: null,
				profitCents: null,
				heroName: null,
				hands: [],
			};
			continue;
		}
		if (!current) continue;

		if (line.startsWith('Game ID:')) current.gameId = line.split(':').slice(1).join(':').trim();
		else if (line.startsWith('Date & Time:')) {
			const t = line.split(':').slice(1).join(':').trim();
			const m = t.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
			current.startedAt = m ? new Date(m[1] + 'Z') : null;
		}
		else if (line.startsWith('Buy In:')) current.buyInCents = parseMoney(line);
		else if (line.startsWith('Rake:')) current.rakeCents = parseMoney(line);
		else if (line.startsWith('Prize pool:')) current.prizePoolCents = parseMoney(line);
		else if (line.startsWith('Multiplier:')) {
			const mm = line.match(/x(\d+(?:\.\d+)?)/);
			if (mm) current.prizeMultiplier = parseFloat(mm[1]);
		}
		else if (line.startsWith('*** PLAYERS ***')) { inPlayers = true; heroName = null; continue; }
		else if (line.startsWith('*** HOLE CARDS ***')) { inHole = true; currentStreet = 'preflop'; continue; }
		else if (line.startsWith('*** SUMMARY ***')) { inSummary = true; continue; }
		else if (line.trim() === '------------') { pushCurrent(); continue; }

        if (inHole && line.startsWith('*** PRE-FLOP ***')) {
            const hand: ParsedHand = { handId: null, sbCents: null, bbCents: null, heroSeat: null, dealtCards: null, board: null, boardFlop: null, boardTurn: null, boardRiver: null, winnerSeat: null, playedAt: current.startedAt, actions: [], players: [...currentPlayers], totalPotCents: pendingTotalPotCents };
            current.hands.push(hand);
        }
		if (line.startsWith('Hand ID:')) {
			const id = line.split(':').slice(1).join(':').trim();
			if (current.hands.length === 0) current.hands.push({ handId: id, sbCents: null, bbCents: null, heroSeat: null, dealtCards: null, board: null, boardFlop: null, boardTurn: null, boardRiver: null, winnerSeat: null, playedAt: current.startedAt, actions: [], players: [], totalPotCents: null });
			else current.hands[current.hands.length - 1].handId = id;
		}
		if (line.startsWith('Total Pot:')) {
			const mm = line.match(/Total Pot:\s*(\d+)/i);
			if (mm) {
				const val = parseInt(mm[1], 10);
				pendingTotalPotCents = val;
				if (current.hands.length > 0) {
					current.hands[current.hands.length - 1].totalPotCents = val;
				}
			}
		}
		if (line.startsWith('Blinds:')) {
			const mm = line.match(/(\d+)\/(\d+)/);
			if (mm) {
				const sb = parseInt(mm[1], 10);
				const bb = parseInt(mm[2], 10);
				if (current.hands.length === 0) current.hands.push({ handId: null, sbCents: sb, bbCents: bb, heroSeat: null, dealtCards: null, board: null, boardFlop: null, boardTurn: null, boardRiver: null, winnerSeat: null, playedAt: current.startedAt, actions: [], players: [], totalPotCents: null });
				else { current.hands[current.hands.length - 1].sbCents = sb; current.hands[current.hands.length - 1].bbCents = bb; }
			}
		}
		if (inPlayers && line.includes('Hero')) {
			// Example: "Seat 3: malicious (1080) [BTN SB Hero]"
			const seatMatch = line.match(/Seat\s+(\d+):\s+([^\(]+)\s*\(/);
			if (seatMatch) {
				const seat = parseInt(seatMatch[1], 10);
				heroName = seatMatch[2].trim();
				nameToSeat[heroName] = seat;
				if (current) current.heroName = heroName;
				if (current.hands.length === 0) current.hands.push({ handId: null, sbCents: null, bbCents: null, heroSeat: seat, dealtCards: null, board: null, boardFlop: null, boardTurn: null, boardRiver: null, winnerSeat: null, playedAt: current.startedAt, actions: [], players: [], totalPotCents: null });
				else current.hands[current.hands.length - 1].heroSeat = seat;
			}
		}
		// Map all seats (not only Hero)
		if (inPlayers && line.startsWith('Seat ')) {
			const m = line.match(/Seat\s+(\d+):\s+([^\(]+)\s*\((\d+)\)/);
			if (m) {
				const seat = parseInt(m[1], 10);
				const name = m[2].trim();
				nameToSeat[name] = seat;
				if (!currentPlayers.find(p => p.seat === seat)) {
					const isHero = /Hero/.test(line);
					currentPlayers.push({ seat, name, startingStackCents: parseInt(m[3], 10), isHero, hole: null });
				}
			}
		}
		if (line.startsWith('*** FLOP ***') || line.startsWith('*** TURN ***') || line.startsWith('*** RIVER ***')) {
			const board = line.replace(/\*\*\* (FLOP|TURN|RIVER) \*\*\*\s*/, '');
			if (current.hands.length === 0) current.hands.push({ handId: null, sbCents: null, bbCents: null, heroSeat: null, dealtCards: null, board, boardFlop: null, boardTurn: null, boardRiver: null, winnerSeat: null, playedAt: current.startedAt, actions: [], players: [], totalPotCents: null });
			else current.hands[current.hands.length - 1].board = board;
			if (line.includes('FLOP')) currentStreet = 'flop';
			else if (line.includes('TURN')) currentStreet = 'turn';
			else if (line.includes('RIVER')) currentStreet = 'river';
			const last = current.hands[current.hands.length - 1];
			if (currentStreet === 'flop') last.boardFlop = board;
			if (currentStreet === 'turn') last.boardTurn = board;
			if (currentStreet === 'river') last.boardRiver = board;
		}
		if (inSummary && heroName) {
			// Example: "malicious finished 1st and wins 20.00 EUR"
			const trimmed = line.trim();
			const re = new RegExp('^' + escapeRegExp(heroName) + '\\s+finished\\s+(\\d+)(?:st|nd|rd)(?:\\s+and\\s+wins\\s+([\\d.,]+))?', 'i');
			const m = trimmed.match(re);
			if (m) {
				current.heroResultPosition = parseInt(m[1], 10);
				if (m[2]) current.heroPrizeCents = parseMoney(m[2]);
			}
		}

		// Dealt cards lines under HOLE CARDS: "Name: [As Kd]"
		if (inHole) {
			const dealt = line.match(/^([^:]+):\s*\[([2-9TJQKA][shdc])\s+([2-9TJQKA][shdc])\]/);
			if (dealt && current.hands.length > 0) {
				const name = dealt[1].trim();
				const seat = nameToSeat[name];
				if (seat) {
					const h = current.hands[current.hands.length - 1];
					if (h.heroSeat === seat) {
						h.dealtCards = `${dealt[2]} ${dealt[3]}`;
					}
					const pl = currentPlayers.find(p => p.seat === seat);
					if (pl) pl.hole = `${dealt[2]} ${dealt[3]}`;
				}
			}
		}

		// SHOWDOWN: "Name shows [Ah Kd] ..."
		if (/^.+\s+shows\s+\[[2-9TJQKA][shdc]\s+[2-9TJQKA][shdc]\]/i.test(line)) {
			const sm = line.match(/^([^\s].*?)\s+shows\s+\[([2-9TJQKA][shdc])\s+([2-9TJQKA][shdc])\]/i);
			if (sm) {
				const name = sm[1].trim();
				const seat = nameToSeat[name];
				if (seat) {
					const hole = `${sm[2]} ${sm[3]}`;
					const pl = currentPlayers.find(p => p.seat === seat);
					if (pl) pl.hole = hole;
					const h = current.hands[current.hands.length - 1];
					if (h.heroSeat === seat) h.dealtCards = hole;
				}
			}
		}

        // Action lines like: "time - Name: Raises to 1080 and is all-in"
        if (/-\s+[^:]+:\s+/.test(line) && current.hands.length > 0) {
			const m = line.match(/-\s+([^:]+):\s+(.+)$/);
			if (m) {
				const actor = m[1].trim();
				const rest = m[2].trim();
				const seat = nameToSeat[actor] ?? null;
				const h = current.hands[current.hands.length - 1];
				if (!h.actions) h.actions = [];
				const pushAction = (type: ParsedAction['type'], sizeCents: number | null, isAllIn: boolean) => {
					h.actions!.push({ orderNo: ++actionOrder, street: currentStreet, seat, type, sizeCents, isAllIn });
				};
				let mm: RegExpMatchArray | null;
				if ((mm = rest.match(/^Posts SB\s+(\d+)/i))) { pushAction('bet', parseInt(mm[1], 10), false); continue; }
				if ((mm = rest.match(/^Posts BB\s+(\d+)/i))) { pushAction('bet', parseInt(mm[1], 10), false); continue; }
				if ((mm = rest.match(/^Raises to\s+(\d+)(?:\s+and\s+is\s+all-in)?/i))) { const isAllIn = /all-in/i.test(rest); pushAction(isAllIn ? 'push' : 'raise', parseInt(mm[1], 10), isAllIn); continue; }
				if ((mm = rest.match(/^Bets\s+(\d+)(?:\s+and\s+is\s+all-in)?/i))) { const isAllIn = /all-in/i.test(rest); pushAction(isAllIn ? 'push' : 'bet', parseInt(mm[1], 10), isAllIn); continue; }
				if ((mm = rest.match(/^Calls\s+(\d+)(?:\s+and\s+is\s+all-in)?/i))) { const isAllIn = /all-in/i.test(rest); pushAction('call', parseInt(mm[1], 10), isAllIn); continue; }
				if (/^Checks/i.test(rest)) { pushAction('check', null, false); continue; }
				if (/^Folds/i.test(rest)) { pushAction('fold', null, false); continue; }
			}
		}

        // Winner seat from summary: capture winner and main pot amount if present
        if (inSummary && current.hands.length > 0) {
            const win = line.match(/^([^\n]+)\s+wins\s+((?:main|side)\s+pot)?\s*.*\s+of\s+(\d+)/i);
            if (win) {
                const winnerName = win[1].trim();
                const seat = nameToSeat[winnerName];
                const last = current.hands[current.hands.length - 1];
                if (seat) last.winnerSeat = seat;
                else if (winnerName === (current.heroName || '')) {
                    // Fallback: if winner is hero by name, use heroSeat
                    if (typeof last.heroSeat === 'number') last.winnerSeat = last.heroSeat;
                }
                const amount = parseInt(win[3], 10);
                if ((win[2] || '').toLowerCase().includes('main')) {
                    (last as any).mainPotCents = amount;
                }
            }
        }
		// Attach players once summary announces winner
		if (inSummary && /wins\s+main\s+pot/i.test(line) && current.hands.length > 0) {
			const h = current.hands[current.hands.length - 1];
			if (!h.players || h.players.length === 0) h.players = [...currentPlayers];
		}
	}

	pushCurrent();
	const tournaments: ParsedTournament[] = Array.from(tournamentsMap.values());
	// Finalize profits
	for (const t of tournaments) {
		if (t.heroPrizeCents != null) {
			t.profitCents = t.heroPrizeCents - (t.buyInCents + t.rakeCents);
		} else if (t.heroResultPosition != null) {
			const prize = t.heroResultPosition === 1 ? t.prizePoolCents : 0;
			t.profitCents = prize - (t.buyInCents + t.rakeCents);
		}
	}
	return { tournaments };
}


