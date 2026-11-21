/**
 * Common English phrasal verbs, idioms and fixed expressions whose meaning a learner can't work out
 * from the words, for on-device definition hints (the tutor finds its own). Each entry is
 * "LEVEL phrase": the CEFR level at which learners usually meet it. A phrase starting with "~" begins
 * with a verb, which also matches in its other forms ("~give up" matches "gave up", "giving up").
 */
const ENTRIES = `
B1 ~break down|B1 ~break up|B1 ~bring up|B1 ~call off|B1 ~calm down|B1 ~carry on|B1 ~catch up|B1 ~check out
B1 ~cheer up|B1 ~come across|B1 ~come up with|B1 ~count on|B1 ~cut down on|B1 ~deal with|B1 ~figure out
B1 ~find out|B1 ~get along|B1 ~get away with|B1 ~get over|B1 ~get rid of|B1 ~give in|B1 ~give up|B1 ~go ahead
B1 ~go off|B1 ~go on|B1 ~go through|B1 ~grow up|B1 ~hang out|B1 ~hang on|B1 ~hold on|B1 ~keep up|B1 ~let down
B1 ~look after|B1 ~look forward to|B1 ~look up to|B1 ~make up|B1 ~make up for|B1 ~mess up|B1 ~pass out
B1 ~pick up|B1 ~point out|B1 ~put off|B1 ~put up with|B1 ~run into|B1 ~run out of|B1 ~set up|B1 ~settle down
B1 ~show off|B1 ~show up|B1 ~sort out|B1 ~take off|B1 ~take over|B1 ~turn down|B1 ~turn out|B1 ~work out
B1 ~freak out|B1 ~hang up|B1 ~give away|B1 ~shut up|B1 ~screw up|B1 ~end up|B1 ~come up|B1 ~drop by
B1 ~drop off|B1 ~fill in|B1 ~get through|B1 ~hold up|B1 ~kick off|B1 ~look into|B1 ~pull over|B1 ~take after
B1 ~make sense|B1 ~take care of|B1 ~pay attention|B1 ~make sure|B1 ~keep in touch|B1 ~get in touch
B1 by the way|B1 after all|B1 at least|B1 in fact|B1 no way|B1 for good|B1 so far|B1 by heart|B1 on purpose
B1 in a hurry|B1 for sure|B1 no wonder|B1 never mind|B1 in charge of|B1 as long as|B1 make yourself at home
B2 ~back off|B2 ~back up|B2 ~blow up|B2 ~brush off|B2 ~bump into|B2 ~butt in|B2 ~chip in|B2 ~come around
B2 ~come clean|B2 ~cover up|B2 ~cut off|B2 ~do without|B2 ~drag on|B2 ~fall apart|B2 ~fall for|B2 ~fall out
B2 ~fall through|B2 ~fill in for|B2 ~get across|B2 ~get at|B2 ~get by|B2 ~get even|B2 ~give out|B2 ~go along with
B2 ~go over|B2 ~hand over|B2 ~hit on|B2 ~hold back|B2 ~keep at|B2 ~kick out|B2 ~knock out|B2 ~lay off|B2 ~leave out
B2 ~let off|B2 ~live up to|B2 ~lock up|B2 ~make out|B2 ~mix up|B2 ~move on|B2 ~nod off|B2 ~own up|B2 ~pass away
B2 ~pay off|B2 ~play down|B2 ~pull off|B2 ~pull through|B2 ~put down|B2 ~put up|B2 ~rip off|B2 ~rule out
B2 ~run over|B2 ~see through|B2 ~set off|B2 ~sink in|B2 ~stand by|B2 ~stand for|B2 ~stand out|B2 ~stand up for
B2 ~step down|B2 ~stick around|B2 ~stick to|B2 ~take back|B2 ~take in|B2 ~take on|B2 ~talk into|B2 ~tear up
B2 ~tell off|B2 ~think over|B2 ~throw up|B2 ~tip off|B2 ~track down|B2 ~turn in|B2 ~turn up|B2 ~wear off
B2 ~wind up|B2 ~work up|B2 ~wrap up|B2 ~zone out|B2 ~chill out|B2 ~hook up|B2 ~cheat on|B2 ~make it
B2 ~break the ice|B2 ~call it a day|B2 ~get the hang of|B2 ~give it a shot|B2 ~keep an eye on|B2 ~lose track of
B2 ~make a scene|B2 ~mind your own business|B2 ~take it easy|B2 ~take your time|B2 ~cut it out|B2 ~knock it off
B2 ~hang in there|B2 ~get cold feet|B2 ~run late|B2 ~sleep on it|B2 ~play it by ear|B2 ~beat around the bush
B2 ~cross your fingers|B2 ~keep your chin up|B2 ~cost an arm and a leg|B2 ~have a crush on|B2 ~make ends meet
B2 piece of cake|B2 under the weather|B2 on the other hand|B2 out of the blue|B2 once in a while|B2 sooner or later
B2 the last straw|B2 in the long run|B2 on the same page|B2 up to you|B2 out of the question|B2 no big deal
B2 better late than never|B2 so to speak|B2 as a matter of fact|B2 at the end of the day|B2 off the record
B2 in the meantime|B2 on second thought|B2 for the time being|B2 at any rate|B2 out of hand|B2 out of order
B2 in no time|B2 all of a sudden|B2 the whole nine yards|B2 by the book|B2 on the house|B2 in hot water
C1 ~bite the bullet|C1 ~blow off steam|C1 ~bring home the bacon|C1 ~burn the midnight oil|C1 ~call the shots
C1 ~cut corners|C1 ~cut to the chase|C1 ~drop the ball|C1 ~face the music|C1 ~get off the hook|C1 ~go the extra mile
C1 ~hit the nail on the head|C1 ~hit the sack|C1 ~hit the road|C1 ~jump the gun|C1 ~kick the bucket
C1 ~let the cat out of the bag|C1 ~miss the boat|C1 ~pull the plug|C1 ~ring a bell|C1 ~rock the boat
C1 ~see eye to eye|C1 ~spill the beans|C1 ~steal the show|C1 ~take a rain check|C1 ~throw in the towel
C1 ~twist someone's arm|C1 ~walk on eggshells|C1 ~wing it|C1 ~bend over backwards|C1 ~bite off more than you can chew
C1 ~add insult to injury|C1 ~beat a dead horse|C1 ~bury the hatchet|C1 ~get out of hand|C1 ~go down in flames
C1 ~have a chip on your shoulder|C1 ~keep at bay|C1 ~leave no stone unturned|C1 ~pass the buck|C1 ~play hardball
C1 ~pull strings|C1 ~read between the lines|C1 ~sit tight|C1 ~stab in the back|C1 ~touch base|C1 ~weigh in
C1 ~cave in|C1 ~fizzle out|C1 ~egg on|C1 ~gloss over|C1 ~hole up|C1 ~iron out|C1 ~pan out|C1 ~rattle off
C1 ~rein in|C1 ~shrug off|C1 ~stave off|C1 ~whip up|C1 ~buckle down|C1 ~chicken out|C1 ~rope in|C1 ~suck up to
C1 a blessing in disguise|C1 a dime a dozen|C1 a long shot|C1 a far cry from|C1 back to square one
C1 the elephant in the room|C1 the tip of the iceberg|C1 a slap on the wrist|C1 a drop in the bucket
C1 on thin ice|C1 on the fence|C1 on the ball|C1 over the moon|C1 up in the air|C1 down to earth
C1 in the nick of time|C1 the real deal|C1 cut and dried|C1 neck and neck|C1 by the skin of your teeth
C1 against the clock|C1 off the top of my head|C1 the ball is in your court|C1 when pigs fly
`;

export type PhraseLevel = 'B1' | 'B2' | 'C1';

export interface PhraseEntry {
  /** As listed, without the verb mark: "give up". */
  text: string;
  level: PhraseLevel;
  /** Word keys to match, the first one in every form when the phrase starts with a verb. */
  words: string[][];
}

const IRREGULAR: Record<string, string[]> = {
  be: ['is', 'are', 'am', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'],
  get: ['gets', 'got', 'gotten', 'getting'],
  come: ['comes', 'came', 'coming'],
  take: ['takes', 'took', 'taken', 'taking'],
  give: ['gives', 'gave', 'given', 'giving'],
  make: ['makes', 'made', 'making'],
  put: ['puts', 'putting'],
  set: ['sets', 'setting'],
  let: ['lets', 'letting'],
  cut: ['cuts', 'cutting'],
  hit: ['hits', 'hitting'],
  run: ['runs', 'ran', 'running'],
  break: ['breaks', 'broke', 'broken', 'breaking'],
  bring: ['brings', 'brought', 'bringing'],
  find: ['finds', 'found', 'finding'],
  hold: ['holds', 'held', 'holding'],
  keep: ['keeps', 'kept', 'keeping'],
  show: ['shows', 'showed', 'shown', 'showing'],
  throw: ['throws', 'threw', 'thrown', 'throwing'],
  fall: ['falls', 'fell', 'fallen', 'falling'],
  hang: ['hangs', 'hung', 'hanged', 'hanging'],
  catch: ['catches', 'caught', 'catching'],
  stand: ['stands', 'stood', 'standing'],
  tell: ['tells', 'told', 'telling'],
  think: ['thinks', 'thought', 'thinking'],
  see: ['sees', 'saw', 'seen', 'seeing'],
  grow: ['grows', 'grew', 'grown', 'growing'],
  blow: ['blows', 'blew', 'blown', 'blowing'],
  lay: ['lays', 'laid', 'laying'],
  pay: ['pays', 'paid', 'paying'],
  leave: ['leaves', 'left', 'leaving'],
  lose: ['loses', 'lost', 'losing'],
  sleep: ['sleeps', 'slept', 'sleeping'],
  wear: ['wears', 'wore', 'worn', 'wearing'],
  tear: ['tears', 'tore', 'torn', 'tearing'],
  bite: ['bites', 'bit', 'bitten', 'biting'],
  beat: ['beats', 'beaten', 'beating'],
  burn: ['burns', 'burned', 'burnt', 'burning'],
  steal: ['steals', 'stole', 'stolen', 'stealing'],
  ring: ['rings', 'rang', 'rung', 'ringing'],
  sink: ['sinks', 'sank', 'sunk', 'sinking'],
  bend: ['bends', 'bent', 'bending'],
  wind: ['winds', 'wound', 'winding'],
  read: ['reads', 'reading'],
  sit: ['sits', 'sat', 'sitting'],
  stick: ['sticks', 'stuck', 'sticking'],
  dig: ['digs', 'dug', 'digging'],
  shut: ['shuts', 'shutting'],
  deal: ['deals', 'dealt', 'dealing'],
  feel: ['feels', 'felt', 'feeling'],
  mean: ['means', 'meant', 'meaning'],
  weigh: ['weighs', 'weighed', 'weighing'],
  stab: ['stabs', 'stabbed', 'stabbing'],
  drop: ['drops', 'dropped', 'dropping'],
  step: ['steps', 'stepped', 'stepping'],
  rip: ['rips', 'ripped', 'ripping'],
  tip: ['tips', 'tipped', 'tipping'],
  nod: ['nods', 'nodded', 'nodding'],
  chip: ['chips', 'chipped', 'chipping'],
  wrap: ['wraps', 'wrapped', 'wrapping'],
  whip: ['whips', 'whipped', 'whipping'],
  shrug: ['shrugs', 'shrugged', 'shrugging'],
  egg: ['eggs', 'egged', 'egging'],
  bump: ['bumps', 'bumped', 'bumping'],
  butt: ['butts', 'butted', 'butting'],
  rope: ['ropes', 'roped', 'roping'],
};

/** A regular verb's forms: "work" → works, worked, working; "carry" → carries, carried, carrying. */
export function verbForms(verb: string): string[] {
  const irregular = IRREGULAR[verb];
  if (irregular) return [verb, ...irregular];
  let s: string, ed: string, ing: string;
  if (/(s|sh|ch|x|z|o)$/.test(verb)) s = `${verb}es`;
  else if (/[^aeiou]y$/.test(verb)) s = `${verb.slice(0, -1)}ies`;
  else s = `${verb}s`;
  if (verb.endsWith('e')) {
    ed = `${verb}d`;
    ing = `${verb.slice(0, -1)}ing`;
  } else if (/[^aeiou]y$/.test(verb)) {
    ed = `${verb.slice(0, -1)}ied`;
    ing = `${verb}ing`;
  } else {
    ed = `${verb}ed`;
    ing = `${verb}ing`;
  }
  return [verb, s, ed, ing];
}

/** Pronouns that stand in for "your" / "someone's" in a listed idiom. */
const POSSESSIVES = ['my', 'your', 'his', 'her', 'its', 'our', 'their', "someone's"];

function parse(): PhraseEntry[] {
  const out: PhraseEntry[] = [];
  for (const raw of ENTRIES.split(/[|\n]/)) {
    const m = /^\s*(B1|B2|C1)\s+(~?)(.+?)\s*$/.exec(raw);
    if (!m) continue;
    const text = m[3].toLowerCase();
    const parts = text.split(' ');
    const words = parts.map((p, i) => {
      if (i === 0 && m[2]) return verbForms(p);
      if (POSSESSIVES.includes(p)) return POSSESSIVES;
      if (p === 'yourself') return ['myself', 'yourself', 'himself', 'herself', 'ourselves', 'yourselves', 'themselves'];
      return [p];
    });
    out.push({ text, level: m[1] as PhraseLevel, words });
  }
  return out;
}

let entries: PhraseEntry[] | null = null;
/** First word key → entries starting with it. */
let byFirst: Map<string, PhraseEntry[]> | null = null;

export function englishPhrases(): Map<string, PhraseEntry[]> {
  if (byFirst) return byFirst;
  entries = parse();
  byFirst = new Map();
  for (const e of entries) {
    for (const form of e.words[0]) {
      const list = byFirst.get(form) ?? [];
      list.push(e);
      byFirst.set(form, list);
    }
  }
  return byFirst;
}
