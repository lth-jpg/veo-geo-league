// Deterministic picker — same day always gets same line (no random surprises on re-runs)
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]
}

function dateSeed(): number {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// ─── Winner ────────────────────────────────────────────────────────────────
const WINNER_LINES = [
  (name: string) => `${name} came, saw, and absolutely cooked everyone. No contest.`,
  (name: string) => `${name} with the top score today. The rest of the league was basically NPCs.`,
  (name: string) => `${name} is on one. Someone stop them.`,
  (name: string) => `${name} leads today's table like it was pre-arranged. Suspicious.`,
  (name: string) => `${name} is built different today. Whatever they had for breakfast, bottle it.`,
  (name: string) => `Day ${new Date().getDate()} and ${name} refuses to be humbled. Respect.`,
  (name: string) => `${name} just sent a message to the entire league and that message is: sit down.`,
  (name: string) => `${name} on top. Expected? No. Impressive? Reluctantly, yes.`,
  (name: string) => `${name} with the best score. Filing this under "will not hear the end of it".`,
  (name: string) => `${name} absolutely went off today. The leaderboard is shaking.`,
  (name: string) => `${name} put in a shift today. An actual, proper shift.`,
  (name: string) => `${name} top of the pile. Someone throw them a bone tomorrow so it stays interesting.`,
]

export function winnerLine(name: string): string {
  return pick(WINNER_LINES, dateSeed())(name)
}

// ─── Loser / Bottom ────────────────────────────────────────────────────────
const LOSER_LINES = [
  (name: string, score: number) => `${name} posted ${score.toLocaleString()} and is dealing with that privately.`,
  (name: string, score: number) => `${name} had a day. ${score.toLocaleString()} is not a score, it's a confession.`,
  (name: string, score: number) => `${score.toLocaleString()} from ${name}. The vibes were not there.`,
  (name: string, score: number) => `${name} finished last with ${score.toLocaleString()}. We've all been there. Some of us more than others.`,
  (name: string, score: number) => `${name} brought ${score.toLocaleString()} to a gunfight. Respect the commitment to chaos.`,
  (name: string, score: number) => `${name} scored ${score.toLocaleString()}. Their controller may need a service.`,
  (name: string, score: number) => `${name} — ${score.toLocaleString()}. No notes. (There are many notes.)`,
  (name: string, score: number) => `${name} hit ${score.toLocaleString()} and immediately went quiet. Understandable.`,
  (name: string, score: number) => `The bottom of today's table belongs to ${name} (${score.toLocaleString()}). A learning experience.`,
  (name: string, score: number) => `${name} posted ${score.toLocaleString()}. The game was clearly not on their side today. Or any side.`,
  (name: string, score: number) => `${name} with ${score.toLocaleString()}. Somewhere, a golf ball is laughing.`,
]

export function loserLine(name: string, score: number): string {
  return pick(LOSER_LINES, dateSeed() + 1)(name, score)
}

// ─── Sub-6000 extreme shame ────────────────────────────────────────────────
const SHAME_LINES = [
  (name: string, score: number) => `${name} just posted ${score.toLocaleString()}. That's not a score, that's a medical incident.`,
  (name: string, score: number) => `🚨 DISASTER ALERT: ${name} — ${score.toLocaleString()}. The game has formally filed a complaint.`,
  (name: string, score: number) => `${name} scored ${score.toLocaleString()}. Five digits was too much to ask apparently.`,
  (name: string, score: number) => `${score.toLocaleString()} from ${name}. At this point they're playing a different game. A worse game.`,
  (name: string, score: number) => `${name} posted ${score.toLocaleString()} and has gone into hiding. Wise move.`,
  (name: string, score: number) => `Breaking: ${name} dropped ${score.toLocaleString()} on the league. The league is not okay.`,
  (name: string, score: number) => `${name} — ${score.toLocaleString()}. Genuinely thought about not posting this. Posted it anyway.`,
  (name: string, score: number) => `${name}'s ${score.toLocaleString()} today sets a new benchmark for suffering.`,
  (name: string, score: number) => `${name} found ${score.toLocaleString()} at the bottom of a hole and submitted it. Fair.`,
  (name: string, score: number) => `${score.toLocaleString()} from ${name}. The only thing lower is their self-esteem right now.`,
  (name: string, score: number) => `${name} delivered ${score.toLocaleString()}. We laughed. Then we felt bad. Then we laughed again.`,
  (name: string, score: number) => `${name} — ${score.toLocaleString()}. If golf is a game of inches, they're playing in miles.`,
]

export function shameLine(name: string, score: number): string {
  return pick(SHAME_LINES, dateSeed() + 2)(name, score)
}

// ─── Red card ──────────────────────────────────────────────────────────────
const RED_CARD_LINES = [
  (giver: string, receiver: string) => `${giver} has seen enough from ${receiver} and reached for the card. Drama.`,
  (giver: string, receiver: string) => `${giver} carded ${receiver}. The beef is real.`,
  (giver: string, receiver: string) => `${giver} woke up and chose violence. ${receiver} takes the card.`,
  (giver: string, receiver: string) => `Red card from ${giver} to ${receiver}. Someone is not happy.`,
  (giver: string, receiver: string) => `${giver} issued a red card to ${receiver}. The audacity. The nerve.`,
  (giver: string, receiver: string) => `${receiver} receives a red card courtesy of ${giver}. No further questions.`,
  (giver: string, receiver: string) => `${giver} → ${receiver}: 🟥. The league descends into chaos.`,
  (giver: string, receiver: string) => `${giver} playing referee now. ${receiver} gets the card and the shame.`,
  (giver: string, receiver: string) => `${giver} couldn't let it slide. ${receiver} — you know what you did.`,
  (giver: string, receiver: string) => `A red card has been issued. ${giver} to ${receiver}. This is not the last we'll hear of it.`,
  (giver: string, receiver: string) => `${giver} takes matters into their own hands. ${receiver} is carded.`,
]

export function redCardLine(giver: string, receiver: string): string {
  return pick(RED_CARD_LINES, dateSeed() + 3)(giver, receiver)
}

// ─── Lead takeover ─────────────────────────────────────────────────────────
const TAKEOVER_LINES = [
  (name: string) => `${name} has taken the league lead. The crown fits.`,
  (name: string) => `${name} moves to #1. Everything else is now background noise.`,
  (name: string) => `New name at the top: ${name}. The throne is occupied.`,
  (name: string) => `${name} just took the lead and they know it.`,
  (name: string) => `The league lead belongs to ${name}. For now. Always for now.`,
  (name: string) => `${name} climbs to the summit. The view from up there hits different.`,
  (name: string) => `${name} takes #1. Someone somewhere is staring at the leaderboard in disbelief.`,
  (name: string) => `${name} is your new monthly leader. Respect the grind.`,
  (name: string) => `${name} claims top spot. We'll see if they can hold it.`,
  (name: string) => `Power move from ${name}. They're leading the table now.`,
]

export function takeoverLine(name: string): string {
  return pick(TAKEOVER_LINES, dateSeed() + 4)(name)
}

// ─── Close race ────────────────────────────────────────────────────────────
const CLOSE_RACE_LINES = [
  (a: string, b: string, gap: number) => `${a} leads ${b} by just ${gap.toLocaleString()} points. This is painful to watch. In a good way.`,
  (a: string, b: string, gap: number) => `${gap.toLocaleString()} points separate ${a} and ${b}. Someone is going to snap.`,
  (a: string, b: string, gap: number) => `${a} vs ${b}: ${gap.toLocaleString()} points in it. The tension is actually insane right now.`,
  (a: string, b: string, gap: number) => `${a} leads by ${gap.toLocaleString()}. ${b} is breathing down their neck.`,
  (a: string, b: string, gap: number) => `${gap.toLocaleString()} points between ${a} and ${b}. It's going to go down to the wire.`,
]

export function closeRaceLine(a: string, b: string, gap: number): string {
  return pick(CLOSE_RACE_LINES, dateSeed() + 5)(a, b, gap)
}

// ─── Perfect score ─────────────────────────────────────────────────────────
const PERFECT_LINES = [
  (name: string) => `${name} just hit 15,000. Maximum. Perfect. The ceiling has been touched.`,
  (name: string) => `15,000 from ${name}. There is literally nothing more to give. They gave it all.`,
  (name: string) => `${name} posted a perfect 15,000. Please screenshot this. It won't happen often.`,
  (name: string) => `PERFECT SCORE. ${name}. 15,000. No words. Only awe.`,
  (name: string) => `${name} hit the max. 15,000. Someone throw them a trophy.`,
]

export function perfectLine(name: string): string {
  return pick(PERFECT_LINES, dateSeed() + 6)(name)
}

// ─── Full turnout ──────────────────────────────────────────────────────────
const TURNOUT_LINES = [
  (count: number) => `All ${count} players submitted today. The commitment is real.`,
  (count: number) => `Full house — ${count}/${count} players checked in. That's what we like to see.`,
  (count: number) => `Everyone showed up today. ${count} for ${count}. Respect across the board.`,
  (count: number) => `${count} players, ${count} submissions. Nobody bottled it today. Remarkable.`,
]

export function fullTurnoutLine(count: number): string {
  return pick(TURNOUT_LINES, dateSeed() + 7)(count)
}

// ─── Solo submission ───────────────────────────────────────────────────────
const SOLO_LINES = [
  (name: string) => `${name} is the only one who submitted today. Lonely at the top. And the bottom.`,
  (name: string) => `Just ${name} today. One player, one score, zero competition. They win by default. Congrats?`,
  (name: string) => `${name} showed up. Nobody else did. The league is questionable.`,
]

export function soloLine(name: string): string {
  return pick(SOLO_LINES, dateSeed() + 8)(name)
}

// ─── Toilet / Wooden Spoon ─────────────────────────────────────────────────
const TOILET_LINES = [
  (name: string, score: number) => `🚽 ${name} takes the wooden spoon with ${score.toLocaleString()}. The porcelain throne awaits.`,
  (name: string, score: number) => `${name} posted ${score.toLocaleString()}. That score went straight to the sewer. 🚽`,
  (name: string, score: number) => `🚽 Flush it. ${name}'s ${score.toLocaleString()} is not something we need to keep.`,
  (name: string, score: number) => `${name} — ${score.toLocaleString()}. There's no spin cycle strong enough for that one. 🚽`,
  (name: string, score: number) => `🚽 Wooden spoon goes to ${name} (${score.toLocaleString()}). The kind of score you don't frame.`,
  (name: string, score: number) => `${name} with ${score.toLocaleString()}. The toilet is calling and it wants its number back. 🚽`,
  (name: string, score: number) => `🚽 ${score.toLocaleString()} from ${name}. That's going straight to the bottom of the bowl.`,
  (name: string, score: number) => `${name} delivered ${score.toLocaleString()} today. Grab a plunger. 🚽`,
  (name: string, score: number) => `🚽 ${name}'s ${score.toLocaleString()} is today's most flushable score. And it's not close.`,
  (name: string, score: number) => `${name} — ${score.toLocaleString()}. Somewhere a toilet is nodding in solidarity. 🚽`,
  (name: string, score: number) => `🚽 ${name} wins the wooden spoon. ${score.toLocaleString()} is a number best forgotten.`,
  (name: string, score: number) => `${name} posted ${score.toLocaleString()} and the porcelain throne has been reserved. 🚽`,
]

export function toiletLine(name: string, score: number): string {
  return pick(TOILET_LINES, dateSeed() + 10)(name, score)
}

// ─── Biggest gainer ────────────────────────────────────────────────────────
const BIGGEST_GAINER_LINES = [
  (name: string, from: number, to: number) => `${name} with a massive leap — up from #${from} to #${to} on the monthly leaderboard. Eyes on them.`,
  (name: string, from: number, to: number) => `${name} on the move. #${from} → #${to}. That's a statement.`,
  (name: string, from: number, to: number) => `${name} climbs from #${from} to #${to} today. The table is shifting.`,
  (name: string, from: number, to: number) => `Big day for ${name} — up ${from - to} spot${from - to === 1 ? '' : 's'} to #${to}. Momentum building.`,
  (name: string, from: number, to: number) => `${name} storming up the rankings. #${from} to #${to} in one day. Serious business.`,
  (name: string, from: number, to: number) => `Biggest mover today: ${name}. From #${from} to #${to}. The rest of the league is watching.`,
  (name: string, from: number, to: number) => `${name} didn't come to play today — they came to climb. #${from} to #${to}. Watch out.`,
  (name: string, from: number, to: number) => `#${from} to #${to} for ${name}. That's not luck, that's a score.`,
]

export function biggestGainerLine(name: string, fromPos: number, toPos: number): string {
  return pick(BIGGEST_GAINER_LINES, dateSeed() + 11)(name, fromPos, toPos)
}

// ─── Morning countdown ─────────────────────────────────────────────────────
const MORNING_OPENERS = [
  'Another day, another chance to embarrass yourself on the leaderboard.',
  'Rise and grind. The leaderboard waits for no one.',
  "Scores close at 14:00. Make sure you're ready. Or don't. We'll roast you either way.",
  'The daily reckoning begins at 14:00. Prepare accordingly.',
  "Today is the day you finally stop being last. Maybe. Probably not. But maybe.",
  'A new day. A fresh slate. Same leaderboard, different humiliations.',
  "Yesterday is gone. Today's disasters are entirely new.",
  'Wake up. Play golf. Post your score. Get carded. Repeat.',
  "The league doesn't sleep but it does get up at 14:00.",
  'Another opportunity to either shine or quietly disappear.',
  'Submission window closes at 14:00. Start mentally preparing.',
  "It's a new day in the league. Someone's getting carded. Not saying who.",
  'The world has 195 countries. Today you will confidently misidentify at least three of them.',
  "Pro tip: the sun angle doesn't help if you're not even on the right continent.",
  "Someone in this league genuinely thought that was Bolivia. They know who they are.",
  'Your GeoGuessr knowledge is about to be tested. Your ego is about to be humbled.',
  "A new day. Somewhere in the world there's a blurry road you're about to place in the wrong hemisphere.",
  "Flag recognition. Language skills. Basic geography. How many of these do you actually have?",
  "Today's score window opens at 14:00. The excuses window is already open.",
  "If you placed Russia in South America yesterday, today is your chance at redemption.",
]

export function morningOpener(): string {
  return pick(MORNING_OPENERS, dateSeed() + 9)
}
