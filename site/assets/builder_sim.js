/* ============================================================================
   Broken Oath damage engine, based on the Broken Oath Builder implementation
   (Lilshrimper and contributors); the planner uses it as the reference model.
   The engine is pure: it takes game data and a character object, no DOM.
   ========================================================================== */
(function (root) {
  'use strict';
  const DT = ['Physical', 'Fire', 'Cold', 'Lightning', 'Poison'];
  const CONVERT_ORDER = ['Physical', 'Lightning', 'Cold', 'Fire', 'Poison'];
  // Brutality ("Deals no elemental damage", flag Keystone/NoElemental): the linked skill loses all Fire, Cold and
  // Lightning, added, converted or extra. The game marks Added Fire "idle" beside it, and a Grave Golem linked with
  // both stays a plain grave golem (2 Nov log: "the grave golem lends LifeRegenPct", no flame blessing).
  const ELEMENTS = ['Fire', 'Cold', 'Lightning'];
  const isNoElem = m => m.stat === 'Keystone' && m.mode === 'Flag' && (m.tags || []).includes('NoElemental');
  const lc = s => String(s == null ? '' : s).toLowerCase();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sum = a => a.reduce((s, x) => s + x, 0);

  // Stats that only matter for defence, economy or utility: never shown as "not modelled".
  const NON_DAMAGE = new Set(['Life', 'Mana', 'EnergyShield', 'Armour', 'Evasion', 'Defences', 'Block', 'Resist', 'MaxResist',
    'LifeRegen', 'LifeRegenPct', 'ManaRegen', 'LifeLeech', 'ManaLeech', 'LifeOnKill', 'ManaOnKill', 'ManaOnHit', 'LifeOnBlock',
    'MoveSpeed', 'GoldFind', 'ItemRarity', 'EsRecharge', 'EsRechargeDelay', 'DamageTaken', 'PhysTakenAsElemental', 'ManaCost',
    'Reservation', 'StunKnockback', 'Str', 'Dex', 'Int', 'Attributes', 'MinionLife', 'TotemLife', 'ChannelCostLess', 'Area',
    'Chains', 'Pierce', 'Fork', 'ChillEffect', 'FreezeDuration', 'SkillDuration', 'CurseLimit', 'MinionCap', 'MinionSpeed',
    'Phys70', 'BloodlustDuration', 'BloodlustMax', 'BloodlustOnKill', 'BloodlustOnBossCrit', 'MinionGuard', 'MinionHunt', 'MinionDeathRecover', 'SkyfallDelay', 'TrapRearm',
    'ConduitCostPct', 'ConduitInterval', 'EngineHoldInRupture', 'EngineHoldWhileSentenced', 'Woebringer', 'PassSentence',
    // Woe supports: Woe Bearer and Lingering Woe change how the Woe spreads and builds Dread, not its strength.
    // Deepened Woe (CurseMore) is read from the Woe gem's sockets in the curse block below.
    'WoeOnHit', 'WoeLinger', 'CurseMore',
    'BloodMagic', 'LifeLeech', 'Dragonling', 'ShockSpreadOnKill',
    // 0.56.5 utility lines (statText, build 26543267): Fortified defence, war cries, banners, reservation, spreads on kill.
    'FortifyMax', 'FortifyEffect', 'CryFury', 'CryLinger', 'BannerStartValour', 'BannerKeepValour', 'VowReserveLess',
    'AuraDrainLess', 'PoisonSpreadOnKill', 'HeraldKillRadius',
    'DexLife']); // Wind Dancer: "+{v} to maximum Life for every 10 Dexterity" (statText)
  // Stats this model uses.
  const HANDLED = new Set(['StrMeleeMore', 'RuthlessBlow', 'Afterimages', 'MaimOnHit', 'MarkOnHit', 'MarkMax', 'MarkEffect', 'Damage', 'AddedDamage', 'Convert', 'DamageAsExtra', 'CritChance', 'CritMulti', 'CastSpeed', 'AttackSpeed',
    'Cooldown', 'Repeats', 'Projectiles', 'Penetration', 'SkillLevel', 'PoisonChance', 'PoisonDamage', 'IgniteChance', 'IgniteDamage', 'BleedChance', 'BleedDamage',
    'DotMulti', 'AilmentDuration', 'CurseEffect', 'Str', 'Dex', 'Int', 'Attributes', 'GrantSupport', 'SkyfallRepeat', 'OrbitCount',
    'ShockChance', 'ShockEffect', 'ShockStacks', 'ArmourMore', 'LowLifeMore', 'CullingStrike', 'Keystone', 'BrandCount', 'IntSpellMore',
    // 0.56.5
    'EvasionMore', 'EnergyShieldMore', 'LifeMore', 'BlockMore', 'TrapCount', 'OrbitRate', 'TickRate', 'SparkRate', 'BlockToDamage']);
  // Skyfall second fall: "falls again 0.4 seconds later for X% of their Damage". The game caps the sum at
  // 100% (log 1 Nov: 190% of sources -> "second fall for 100%", "SkyfallSheet68 ... on the sheet (x2.00)")
  // and the second fall strikes each enemy once per cast (one boss hit per cast in every Guardian fight).
  const SKYFALL_REPEAT_CAP = 100;
  // Gear levels (patch 0.55): the first 5 levels above a gem's own level grow as before (spells x1.19,
  // attacks x1.06); each one past +5 only x1.04 (spells) / x1.01 (attacks). Not in the data files; the game
  // logs it at start (5 Nov, before that day's patch: "MetaPlan83: gem level fade from +5, spells x1.040, attacks x1.010").
  // Death Coil tooltip 5 Nov (gem 20+7): Physical 2,984-4,740 + Poison 13,585-21,577; the sheet with this
  // rule (and no Skyfall, see below) gives 16,467-26,154 in all, 0.6% under the game's 16,569-26,317.
  // Patch notes 5 Nov (Steam build 26474163): "bonus gem levels past +5 now grow spell damage 6% a level (was 4%)
  // ... Minion skills: 8% a level." Attacks unchanged. Gem-scaled added damage on attacks keeps the old x1.04
  // (BONUS_FADE_ADDED, the Ballista fit below) until a log shows whether it moved with spells.
  const BONUS_FULL_LEVELS = 5, BONUS_FADE_SPELL = 1.06, BONUS_FADE_MINION = 1.08, BONUS_FADE_ATTACK = 1.01, BONUS_FADE_ADDED = 1.04;
  const bonusSplit = bonus => [Math.min(bonus, BONUS_FULL_LEVELS), Math.max(0, bonus - BONUS_FULL_LEVELS)];
  // Patch 0.56.0 (developer's patch notes, Discord 6 Nov 2026 21:28 UTC). Its rules below switch on with game data
  // newer than Steam build 26474163 (0.55.2), or, for game files a player loads (no build number), files dated
  // after the notes, so the sim keeps matching 0.55.2 until the new data is in.
  const LAST_BUILD_055 = 26474163;
  const is056 = GD => GD.steamBuild ? +GD.steamBuild > LAST_BUILD_055 : String(GD.filesAt || '') >= '2026-11-06T21';
  // 0.56.0: "Spells and minion gems keep growing past +5 levels on a smooth curve (x1.16, x1.13, x1.10, then x1.08
  // per level) instead of the flat old fade." Read as +6 x1.16, +7 x1.13, +8 x1.10, +9 and on x1.08; check it
  // against the game's start-up log line (MetaPlan83) once 0.56 is installed. Attacks and gem-scaled added
  // damage keep their fades (the notes name only spells and minions).
  // Patch 0.56.2 (developer's patch notes, Discord 7 Nov 2026 07:34): "Every cooldown now recovers faster with your attack or
  // cast speed" and "you stand at most 6 Ballistas and 10 Totems". Switches on with data newer than 0.56.0 (Steam build
  // 26495270); game files a player loads (no build number) count from the day of the notes.
  const LAST_BUILD_0560 = 26495270;
  const is0562 = GD => GD.steamBuild ? +GD.steamBuild > LAST_BUILD_0560 : String(GD.filesAt || '') >= '2026-11-07T07';
  // Patch 0.56.3 (developer's patch notes, Discord 7 Nov 2026 20:57): Shield Throw is a Shield skill with +1% increased damage per 5
  // armour, evasion and energy shield on the shield (also in the game's Shield Throw gem text, build 26514814); Added Fire,
  // Ember Bolt, Orbiting Hammers, mana cost and monster life come through the game data. Switches on with data newer than 0.56.2.
  const LAST_BUILD_0562 = 26505528;
  const is0563 = GD => GD.steamBuild ? +GD.steamBuild > LAST_BUILD_0562 : String(GD.filesAt || '') >= '2026-11-07T20';
  // Patch 0.56.4 (developer's patch notes, Discord 8 Nov 2026): Hammer of Judgement 8% more Slam damage per 1,000 Armour up to
  // 20,000 then 3% per 1,000; Mountainborn 1.75% per 10 Strength up to 500 then 0.75%; trap re-arm speed past +100% counts
  // half; stacked Shocks reach 75%; afterimages past 3 add half damage each. Switches on with data newer than 0.56.3
  // (Steam build 26514814); game files a player loads (no build number) count from the day of the notes.
  const LAST_BUILD_0563 = 26514814;
  const is0564 = GD => GD.steamBuild ? +GD.steamBuild > LAST_BUILD_0563 : String(GD.filesAt || '') >= '2026-11-08T00';
  // Patch 0.56.5 (developer's patch notes, pasted by the owner 9 Nov 2026; game texts in Steam build 26543267):
  // totems/ballistas and traps of one skill share their damage, stat engines add together, support and gear repeats
  // stack with the smaller set at 50% less, Cast on Crit runs on one clock, one cast throws all Sparks. Switches on
  // with data newer than 0.56.4 (Steam build 26525248); game files a player loads count from the day of the notes.
  const LAST_BUILD_0564 = 26525248;
  const is0565 = GD => GD.steamBuild ? +GD.steamBuild > LAST_BUILD_0564 : String(GD.filesAt || '') >= '2026-11-09';
  // Patch 0.56.7 (developer's patch notes, pasted by the owner 10 Nov 2026; game texts in Steam build 26568753): "More Damage now has a
  // knee: on your own hits every more multiplier counts in full up to x8, past x8 each doubling adds x1.41. Minions keep their own"
  // and traps "past your sixth adds 25%" (Trap Support text; was 40%). Switches on with data newer than 0.56.6 (build 26551640).
  const LAST_BUILD_0566 = 26551640;
  const is0567 = GD => GD.steamBuild ? +GD.steamBuild > LAST_BUILD_0566 : String(GD.filesAt || '') >= '2026-11-10';
  // Knee: m <= 8 stays; above it 8 x 1.41^log2(m/8). Not applied to minion sheets (minionSheet is separate).
  const moreKnee = m => m <= 8 ? m : 8 * Math.pow(1.41, Math.log2(m / 8));
  // 0.56.5 count rule (Multiple Totems and Trap Support texts, build 26543267): "each past the first adds 80% of one's
  // damage, and each past the sixth adds 20%" (Totems and Ballistas of one skill); Traps "90% ... past your sixth 40%".
  // Returned as the average share of one, so rate x count x share = the whole.
  function countShare(n, next, past6) {
    if (!(n > 1)) return 1;
    return (1 + (Math.min(n, 6) - 1) * next + Math.max(0, n - 6) * past6) / n;
  }
  // Checked against in-game Storm Spark tooltips (owner screenshots, 10 Nov 2026, "Levels from gear and passives: X% more damage in total"):
  // gem 20 -> 23: +69% (1.19^3 = 1.685), 25: +139% (1.19^5 = 2.386), 27: +213% (2.386 x 1.16 x 1.13 = 3.128). So steps 1.16 and 1.13
  // are confirmed; 1.10 and 1.08 (levels 28+) are still patch-note only.
  const BONUS_CURVE_056 = [1.16, 1.13, 1.10, 1.08];
  const spellFade = GD => is056(GD) ? BONUS_CURVE_056 : BONUS_FADE_SPELL;
  const minionFade = GD => is056(GD) ? BONUS_CURVE_056 : BONUS_FADE_MINION;
  // Growth over n faded levels: a flat x fade a level, or a curve (one step a level, the last step repeating).
  function fadeGrowth(fade, n) {
    if (!Array.isArray(fade)) return Math.pow(fade, n);
    let p = 1; for (let i = 0; i < n; i++) p *= fade[Math.min(i, fade.length - 1)];
    return p;
  }
  // Spell (and minion, with its own fade) growth for gem level own + bonus.
  function spellLevelGrowth(g, own, bonus, fade) {
    const [full, faded] = bonusSplit(bonus);
    return Math.pow(g, own - 1 + full) * fadeGrowth(fade || BONUS_FADE_SPELL, faded);
  }
  // Orbit arrows: Split Shot with 9 projectiles orbits 8 (2 Nov log "arrows=8", panel "8 spheres"),
  // Lightning Arrow with 4 orbits all 4 (log "arrows=4"). Not in the data files: inferred limit.
  const ORBIT_MAX_ARROWS = 8;
  // Cast on Crit in an attack with nothing linked (patch notes 5 Nov, support text): the attack strikes by itself
  // when your other attacks crit, at most once every 0.75 s for all such attacks, for a further 44% less damage.
  // Only in the support's text, not in its stats.
  const COC_ATTACK_GAP = 0.75, COC_ATTACK_LESS = -44;
  // The minion army (game log 6 Nov, ArmyBack81): 40 in all, past 27 each body adds 0.50 of a body.
  const ARMY_TOTAL = 40, ARMY_FULL = 27, ARMY_PAST = 0.5;
  // Each Spell Echo repeat of a Spell Totem's cast, at 80% (patch notes 4 Nov, patch 0.53). Log 9 Nov 2026, Heartwood
  // Ancient fight (10 totems): 357 numbered Judgement casts in 7.46 s, 71-80/s once 10 stood against 27.8/s from the
  // totems alone, so the echoes do fire (2 per cast). The game's panel DPS does NOT count them: the owner's tooltips that
  // day (0.36 s totems, Repeats 2) show 82,318,064 DPS with a 100% second fall and 119,408,240 with an 80% one, which is
  // 27.8 casts/s x hit x crit x (1 + second fall) to within 0.5%. The 80% share itself is unchecked (the fight damage ran
  // about 2x over the sim for other reasons too), so the sheet's DPS here runs ~2.6x over the game's panel number.
  const TOTEM_ECHO = 0.8;
  // A summon (its damage is the minions'). Gravereap (patch 5 Nov) is an attack with a Minion block: its kills
  // rise as Risen Thralls, but its own sweep is the hit, so it is simmed as an attack.
  const isSummon = s => !!s && (s.Delivery === 'Summon' || (!!s.Minion && !(s.Tags || []).includes('Attack')));
  // Shortest use time per class and skill (seconds), measured in the game: the clip's speed cap
  // (scaling.json ActionRateMax 4). Split Shot: every release in the 2 Nov log ends at 0.35 s and the
  // skill panel says "2.86 uses a second (speed cap)".
  const CLIP_FLOOR = { ranger: { split_shot: 0.35 } };
  // Dragonling nodes the game applies differently from their text. Hail of Talons (2 Nov, Split Shot panel):
  // the hit ranges match only without its 8% less.
  const DRAGON_QUIRKS = {
    ranger_skyhunter_hail_of_talons: {
      skipLess: 'Hail of Talons: its 8% less damage is left out, as the game\'s skill panel does (Split Shot hit ranges match only without it).',
    },
  };

  // ---------- character extraction (from a parsed GVAS save) ----------
  function extractCharacter(save) {
    const R = (save.props || {}).Record;
    if (!R || !R.Summary) throw new Error('This is not a Broken Oath character save (BO_Char_*.sav).');
    const S = R.Summary;
    return {
      id: S.ID, name: S.Name, classId: S.ClassId, level: S.Level, league: S.League, lastZone: S.LastZone,
      items: (R.Items || []).filter(i => i.EquippedSlot && i.EquippedSlot !== 'None').map(i => ({
        slot: i.EquippedSlot, base: i.BaseID, rarity: i.Rarity, unique: i.UniqueID, name: i.Name, level: i.ItemLevel, quality: i.Quality || 0,
        sockets: i.Sockets != null ? i.Sockets : ((i.Runes || []).length || undefined),
        affixes: (i.Affixes || []).map(a => ({ id: a.AffixId, tier: a.Tier, v: a.Value, v2: a.Value2, crafted: !!(a.bCrafted || a.crafted), oath: !!(a.bOath83 || a.oath) })), runes: i.Runes || [],
      })),
      passives: R.PassiveNodeIds || [], bonusPoints: R.BonusPassivePoints || 0, gems: R.Gems || [], gemLevels: R.GemLevels || {},
      sockets: (R.Sockets || []).map(s => ({ skill: s.SkillId, supports: (s.Supports || []).filter(Boolean), conduit: s.ConduitLink || '' })),
      hotbar: R.Hotbar || [], weaponId: R.WeaponId, dragonNodes: R.DragonlingNodes || [], dragonAspect: R.DragonlingAspect || '',
      mainSkill: R.MainSkillPin || '',
      supportGems: R.SupportGems || [], // spare support gems in the inventory
    };
  }

  // ---------- character from an in-game build code ----------
  // A build code is "BO1." + base64url(uint32 length + zlib(JSON)). This takes the decoded JSON:
  // {v, t?, c, l, p, h, s:[{k, l, u}], g:[{s, b, r, u?, n?}], da, dn}. Codes carry no rolled stats: rare and
  // magic items come in as bare bases, uniques at the middle of each roll (uniqueRoll 0..1 moves that).
  function characterFromCode(GD, j, opt) {
    opt = opt || {};
    if (!j || !j.c || !Array.isArray(j.p)) throw new Error('This build code has no class or passive tree.');
    const roll = opt.uniqueRoll == null ? 0.5 : opt.uniqueRoll;
    const at = (lo, hi) => lo == null ? 0 : Math.round((lo + (hi - lo) * roll) * 100) / 100;
    const warnings = [];
    const bare = [], unknown = [];
    const items = (j.g || []).map(g => {
      const it = { slot: g.s, base: g.b, rarity: g.r || 'Normal', unique: g.u || 'None', name: g.n || '', level: j.l || 1, affixes: [], runes: [] };
      if (g.u) {
        const u = GD.uniques[lc(g.u)];
        if (!u) unknown.push(g.u);
        else u.Mods.forEach((m, i) => { if (m.Mod) it.affixes.push({ id: 'unique:' + i, tier: 0, v: at(m.Min, m.Max), v2: at(m.Min2, m.Max2) }); });
        if (u && !it.name) it.name = u.Name;
      } else if (g.r && g.r !== 'Normal') bare.push(g.s + (g.n ? ' (' + g.n + ')' : ''));
      return it;
    });
    if (bare.length) warnings.push(bare.length + ' rare/magic item' + (bare.length > 1 ? 's' : '') + ' count as bare bases (the code has no rolled stats): ' + bare.join(', ') + '.');
    if (items.some(i => i.unique !== 'None')) warnings.push('Unique items use the middle of each roll.');
    if (unknown.length) warnings.push('Unknown unique' + (unknown.length > 1 ? 's' : '') + ': ' + unknown.join(', ') + '.');
    const skills = j.s || [];
    const gemLevels = {}; for (const s of skills) if (s.k) gemLevels[s.k] = s.l || 1;
    const hotbar = (j.h || []).filter(x => x != null);
    const main = skills.slice().sort((a, b) => (b.u || []).length - (a.u || []).length)[0];
    const sig = JSON.stringify([j.c, j.l, j.p.length, j.p.slice(-3), j.t || '']);
    let hash = 0; for (let i = 0; i < sig.length; i++) hash = (hash * 31 + sig.charCodeAt(i)) | 0;
    return {
      id: 'code:' + (hash >>> 0).toString(16), name: (j.t || j.c + ' build') + ' (code)', classId: j.c, level: j.l || 1, league: '', lastZone: '',
      items, passives: j.p.filter(id => !/^start_/.test(id)), gems: [...new Set([...Object.keys(gemLevels), ...hotbar.filter(h => h && h !== 'move')])], gemLevels,
      sockets: skills.filter(s => (s.u || []).length).map(s => ({ skill: s.k, supports: s.u.filter(x => x && !String(x).includes('@')) })),
      hotbar, weaponId: '', dragonNodes: j.dn || [], dragonAspect: j.da || '', mainSkill: main ? main.k : '', supportGems: [],
      fromCode: true, codeWarnings: warnings,
    };
  }

  // ---------- tags ----------
  function splitTags(tags) {
    const types = []; const conds = []; let gemScaled = false;
    for (const t of tags || []) {
      if (t === 'Elemental') types.push('Fire', 'Cold', 'Lightning');
      else if (DT.includes(t)) types.push(t);
      else if (t === 'GemScaled') gemScaled = true;
      else if (t.includes('=')) { /* trigger parameters */ }
      else conds.push(t);
    }
    return { types, conds, gemScaled };
  }
  const has = (set, t) => set.has(lc(t));
  // Trigger lines (passive_tree.json): Trigger [<when>, <shape>, <skill kinds...>, Key=Value ...], Value2 = the
  // trigger's own cooldown in seconds. <when>: Hit, Crit, SkillUse (counted below); Kill, Roll, Block, WhenHit,
  // MinionDeath, Pulse (not counted: they need kills, rolls or blocks). The game logs each one as
  // "Trigger: Hit -> Nova (<skill>, fired N) el <Element> pct <Pct> nth <Nth>" (log 9 Nov 2026, Oath of the Pyre).
  const TRIG_WHEN = new Set(['Hit', 'Crit', 'SkillUse', 'Kill', 'Roll', 'Block', 'WhenHit', 'MinionDeath', 'Pulse']);
  const TRIG_SHAPE = new Set(['Nova', 'DawnPillar', 'SkySwords', 'Eruption', 'Whirl', 'StormWolf']);
  const TRIG_STATE = new Set(['VsBurning', 'VsBurningOrShocked']);
  function trigParse(m) {
    const p = {}; let when = null, shape = null; const conds = [], types = [], state = [];
    for (const t of m.tags || []) {
      if (t.includes('=')) { const [k, v] = t.split('='); p[k] = isNaN(+v) ? v : +v; }
      else if (TRIG_WHEN.has(t)) when = t;
      else if (TRIG_SHAPE.has(t)) shape = t;
      else if (TRIG_STATE.has(t)) state.push(t);
      else if (DT.includes(t)) types.push(t);
      else conds.push(t);
    }
    return { when, shape, conds, types, state, nth: p.Nth || 1, pct: p.Pct || 0, count: p.Count || 1, element: p.Element || null, perTarget: p.PerTarget || 0, cooldown: m.v2 || 0 };
  }

  // ---------- modifier collection ----------
  // How much the n-th Vow (0 = first) on a red item counts: GD.vowShares (cube_recipes.json Vows83), past the list its last share.
  function vowShare(GD, n) { const s = GD.vowShares || []; return s.length ? s[Math.min(n, s.length - 1)] : 1; }
  function itemLabel(GD, it) {
    const base = GD.bases[lc(it.base)];
    const u = GD.uniques[lc(it.unique)];
    return (it.name || (u && u.Name) || (base && base.Name) || it.base) + ' (' + it.slot + ')';
  }

  // Every modifier the character has, before choosing a skill. Returns {mods, notes, sources}.
  function collectMods(GD, ch, o) {
    const off = o.off || new Set();
    const mods = []; const notes = []; const sources = [];
    const add = (m, v, v2, src, key, extra) => {
      if (!m || !m.Stat) return;
      mods.push(Object.assign({ stat: m.Stat, mode: m.Mode, tags: m.Tags || [], v: v != null ? v : (m.Value || 0), v2: v2 != null ? v2 : (m.Value2 || 0), local: !!m.bLocal, src, key }, extra || {}));
    };

    for (const it of ch.items) {
      const key = 'item:' + it.slot; const label = itemLabel(GD, it); const base = GD.bases[lc(it.base)];
      const rw = runewordFor(GD, it, base);
      sources.push({ key, label, group: 'Gear', detail: rw ? 'Runeword: ' + rw.Name : (it.rarity || '') });
      if (off.has(key)) continue;
      if (base) for (const m of base.Implicits || []) add(m, m.Value, m.Value2, label + ' · implicit', key);
      else notes.push('Unknown item base ' + it.base + ' on ' + it.slot);
      let vowN = 0;
      // Idols never get the Great / Flawless boost: the owner's Dwarven Fossil panel (9 Nov 2026) shows +76% critical
      // multiplier and totems 43% faster from idols rolled 22+18+18+18 and 13+10+10+10, the unboosted values (boosted they
      // would be 98.8 and 55.9), and with them the Judgement tooltip's x5.25 crit and 0.36 s totems come out right.
      const rolled = it.rarity === 'Rare' && is056(GD) && it.slot !== 'Idol' ? it.affixes.filter(a => !a.id.startsWith('unique:') && GD.affixes[lc(a.id)]) : [];
      // "Top tier" means the best tier the item's level allows, not tier 0: tooltips + character panel, 10 Nov 2026
      // (Shrimpmage): Rune Circle (ilvl 42, every line on its level's top tier) shows all rolled lines x1.3 (life 42 -> 55,
      // ES 24 -> 31, Int 24 -> 31, leech 0.6 -> 0.8; the implicit poison res stays 17); Gloom Clutch (ilvl 54, 5 of 6 top)
      // and Grave Brow (ilvl 66, 4 of 6) show x1.1 (Int 30 -> 33, 33 -> 36); four ilvl-84 rares with 0-1 tier-0 lines show
      // the save's values. That closes the panel's Int (223 vs 210) and ES (items +90 vs 83) gaps exactly.
      const topAt = a => { const T = (GD.affixes[lc(a.id)] || {}).Tiers || []; const i = T.findIndex(t => t.ILvl <= (it.level || 0)); return i < 0 ? 0 : i; };
      const topLines = rolled.filter(a => a.tier <= topAt(a)).length;
      const rareKind = rolled.length && topLines === rolled.length ? 'Flawless Rare' : topLines >= 4 ? 'Great Rare' : '';
      const rareBoost = rareKind === 'Flawless Rare' ? 1.3 : rareKind === 'Great Rare' ? 1.1 : 1;
      for (const a of it.affixes) {
        if (a.id.startsWith('unique:')) {
          const u = GD.uniques[lc(it.unique)]; const um = u && u.Mods[+a.id.slice(7)];
          if (um) add(um.Mod, a.v, a.v2, label, key, { text: um.Text }); else notes.push('Unknown unique line ' + a.id + ' on ' + label);
        } else {
          const af = GD.affixes[lc(a.id)];
          if (!af) { notes.push('Unknown affix ' + a.id + ' on ' + label); continue; }
          // An affix on a red item is a Vow: the 1st counts in full, each later one less (vowShare; cube_recipes.json
          // Vows83 Shares 100/85/70/60/50/40%, applied on the owner's say, 6 Nov 2026). Saves keep the full value.
          let sh = it.rarity === 'Unique' ? vowShare(GD, vowN++) : 1;
          // Patch 0.56.0 notes: "Vows that grant +skill levels count at half value" (on top of the Vow's share).
          if (it.rarity === 'Unique' && af.Mod && af.Mod.Stat === 'SkillLevel' && is056(GD)) sh *= 0.5;
          // Patch 0.56.0 notes: "A rare with 4 or more lines at their top tier is a GREAT RARE and its rolled lines
          // count 10% more; a FLAWLESS RARE, every line at its top tier, counts 30% more." Saves keep each line's
          // tier (0 = the top one in affixes.json). NOT CHECKED: whether the save's value already has it.
          if (rareBoost !== 1) sh *= rareBoost;
          add(af.Mod, a.v * sh, a.v2 * sh, label + (it.rarity === 'Unique' ? ' · Vow ' + vowN + (sh < 1 ? ' (' + Math.round(sh * 100) + '%)' : '') : rareBoost !== 1 ? ' (' + rareKind + ' x' + rareBoost + ')' : ''), key);
        }
      }
      const weaponSlot = it.slot === 'MainHand' || it.slot === 'OffHand';
      for (const r of it.runes) {
        const rd = GD.runes[lc(r)]; if (!rd) { notes.push('Unknown rune ' + r); continue; }
        // Runes give half value in magic, rare or red (unique) items; only white items keep full value. Tooltips 9 Nov 2026
        // (rare Dread Edge: Perthro 16% crit / +6% multi = half of 32% / +12%) and 10 Nov 2026 (rare helm Grave Brow: "Isa in this
        // socket: 50% effect", +21 ES = half of 42). With it Shrimpmage's max ES is 6,157 vs the character panel's 6,159.
        const rs = it.rarity && it.rarity !== 'Normal' ? 0.5 : 1;
        for (const m of (weaponSlot ? rd.Weapon : rd.Armour) || []) add(m, (m.Value || 0) * rs, (m.Value2 || 0) * rs, label + ' · rune ' + rd.Name + (rs < 1 ? ' (half value)' : ''), key);
      }
      if (rw) {
        for (const mm of rw.Mods) add(mm.Mod, mm.Mod.Value, mm.Mod.Value2, label + ' · runeword ' + rw.Name, key);
        // Power lines count Power2H times on a two-handed base (the game logs Poison gems at +3 from
        // Nightshade's "+1.5" on a staff).
        const twoHand = base.bTwoHanded || (base.Tags || []).includes('TwoHand');
        const pm = twoHand && rw.Power2H ? rw.Power2H : 1;
        const power = runewordPower(rw, it.level);
        for (const mm of power.mods) add(mm.Mod, (mm.Mod.Value || 0) * pm, (mm.Mod.Value2 || 0) * pm, label + ' · runeword ' + rw.Name + ' (power' + (power.band ? ', item level ' + power.band + '+' : '') + (pm > 1 ? ' x' + pm + ' two-handed' : '') + ')', key);
      }
    }

    sources.push({ key: 'passives', label: 'Passive tree (' + ch.passives.length + ' nodes)', group: 'Character' });
    if (!off.has('passives')) {
      for (const id of ch.passives) {
        const n = GD.nodes[id] || GD.nodes[GD.moved[id]];
        if (!n) { notes.push('Passive node not in current tree: ' + id); continue; }
        for (const m of n.Mods || []) add(m, m.Value, m.Value2, 'Passive · ' + n.Name + (n.Kind === 'Keystone' || n.Kind === 'Notable' ? ' (' + n.Kind + ')' : ''), 'passives');
      }
    }

    const dcls = GD.dragon.classes[lc(ch.classId)] || {};
    if (ch.dragonNodes.length || ch.dragonAspect) {
      sources.push({ key: 'dragon', label: 'Dragonling (' + (ch.dragonAspect || 'no aspect') + ', ' + ch.dragonNodes.length + ' nodes)', group: 'Character' });
      if (!off.has('dragon')) {
        const asp = GD.dragon.aspects[ch.dragonAspect];
        if (asp) for (const m of asp.Mods) add(m, m.Value, m.Value2, 'Dragonling · ' + asp.Name + ' Aspect', 'dragon');
        // Ascendancy: for listed classes, a node's Ascend block replaces its name and lines (only the
        // chosen path's nodes can be taken, so every taken node with one is ascended).
        const ascOn = GD.dragon.ascend && GD.dragon.ascend.enabled && GD.dragon.ascend.classes.includes(lc(ch.classId));
        for (const id of ch.dragonNodes) {
          const n = dcls[id]; if (!n) { notes.push('Dragonling node not found: ' + id); continue; }
          const a = ascOn && n.Ascend;
          let list = (a ? a.Mods : n.Mods) || [];
          if (!a && n.AspectMods && n.AspectMods[ch.dragonAspect]) list = list.concat(n.AspectMods[ch.dragonAspect]);
          const label = 'Dragonling · ' + (a ? a.Name + ' (ascended ' + n.Name + ')' : n.Name);
          const quirk = DRAGON_QUIRKS[id] || {};
          for (const m of list) {
            if (quirk.skipLess && m.Stat === 'Damage' && m.Mode === 'More' && m.Value < 0) { notes.push(quirk.skipLess); continue; }
            add(m, m.Value, m.Value2, label, 'dragon', a ? { text: a.Text } : null);
          }
        }
      }
    }

    // Vows and Heralds on the hotbar (sworn). Their value grows per gem level.
    // What-if Heralds (o.tryHeralds = { herald id: gem level }): the page's Vows/Heralds tab lets you try a Herald that
    // is not on the bar, e.g. Ember Spark without and with Herald of Storms. Same lines as a sworn Herald, at the gem
    // level you pick. UI feature, no new game rule.
    const tryH = o.tryHeralds || {};
    for (const b of Object.values(GD.blessings)) {
      const trying = /herald/i.test(b.Id) && tryH[b.Id] > 0 && b.Skill && !ch.hotbar.includes(b.Skill);
      if (b.Kind !== 'Vow' || !b.Skill || !(ch.hotbar.includes(b.Skill) || trying)) continue;
      const key = 'vow:' + b.Id;
      const lvl = blessingGemLevel(GD, ch, b, mods, o, trying ? +tryH[b.Id] : 0);
      const brk = o.vowbreak && o.vowbreak.has(b.Id) && b.Vowbreak ? b.Vowbreak.Mult : 1;
      sources.push({ key, label: b.Name + ' (gem ' + lvl + (trying ? ', what-if, not on bar' : '') + ')', group: 'Vows & Heralds', vowbreak: !!b.Vowbreak, vowId: b.Id, defaultOff: !/herald/i.test(b.Id) });
      if (off.has(key)) continue;
      for (const m of b.Mods || []) add(m, ((m.Value || 0) + (m.PerLevel || 0) * (lvl - 1)) * brk, m.Value2, b.Name + (brk > 1 ? ' (Vowbreak x' + brk + ')' : ''), key);
    }
    // Charges: Fury / Insight / Resolve, counted by the user.
    // Bloodlust (blessings.json Stack): 0.6% more damage a stack, at most 50 + BloodlustMax lines (tree, The Red
    // Hunger, The Wolf's Due). Gained on kills (or boss crits with The Wolf's Due), so the user sets the stacks.
    for (const [id, n0] of Object.entries(o.charges || {})) {
      const b = GD.blessings[id]; if (!b || !n0) continue;
      let n = n0;
      if (id === 'bloodlust') {
        const max = 50 + mods.filter(m => m.stat === 'BloodlustMax' && m.mode === 'Flat').reduce((s, m) => s + m.v, 0);
        n = Math.min(n0, max);
        if (n < n0) notes.push('Bloodlust: at most ' + max + ' stacks with your gear and tree (50 + "maximum Bloodlust" lines).');
      }
      for (const m of b.Mods || []) add(m, (m.Value || 0) * (m.PerStack ? n : 1), m.Value2, b.Name + ' x' + n, 'charge:' + id);
    }
    // Brewmaw's potions from the Brewery tab (brewery.js works out each potion's lines; the user turns a slot off in
    // the Vows list). What proves it: potions.json, the game's own lines and tooltip text (Vowbreaker's Draught
    // "15% more Damage" = Damage More 15; Glassjaw's Spite "25% less damage dealt" = Damage More -25), and the 6 Nov
    // 2026 log: "Brewmaw's potions ON", "drank slot 3 Potent Grave Tonic of Quickening (grave_tonic) for 4.2 s"
    // (5 s base x 0.85, Potent's "15% shorter"). Utility lines hold while the potion is active, on-drink lines for 4 s.
    for (const p of o.potions || []) {
      if (!p || !p.key) continue;
      sources.push({ key: p.key, label: p.label, group: 'Potions' });
      if (off.has(p.key)) continue;
      for (const m of p.mods || []) add(m, m.Value, m.Value2, p.label, p.key);
    }
    for (const m of o.extra || []) add(m, m.Value, m.Value2, m.src || 'What-if', 'extra');
    return { mods, notes, sources };
  }

  // +levels from gear for a skill: SkillLevel lines whose tags the skill carries ("Gem" = any gem).
  function levelBonus(sk, isGem, mods) {
    const tags = new Set([...(sk.Tags || []), sk.Delivery].map(lc)); if (isGem) tags.add('gem');
    let b = 0;
    for (const m of mods) if (m.stat === 'SkillLevel' && m.mode === 'Flat' && (m.tags || []).every(t => tags.has(lc(t)))) b += m.v;
    return Math.floor(b);
  }

  function blessingGemLevel(GD, ch, blessing, mods, opt, tryLevel) {
    // Fight-only observation override. 10 Nov 23:49 to 11 Nov 00:04 log:
    // both Heralds repeatedly swear at 28 while gear predicts 30. Keeping the
    // damage skill at 32 and these at 28 gives panel 107.387M vs game 107.327M.
    // This does not infer a different general rule for +levels on equipment.
    const logged = opt.blessingLevels && opt.blessingLevels[blessing.Id];
    if (Number.isInteger(logged) && logged > 0) return logged;
    const sk = GD.skills[lc(blessing.Skill)];
    const own = tryLevel || ch.gemLevels[blessing.Skill] || 1;
    return own + (sk ? levelBonus(sk, tryLevel ? sk.Kind === 'Gem' : ch.gems.includes(blessing.Skill) || sk.Kind === 'Gem', mods) : 0);
  }

  // Power lines by item level: the highest band reached (PowerBandILvl) replaces the base PowerMods
  // one for one (Maelstrom: 127% -> 152 / 180 / 212% at item level 56 / 70 / 84).
  // Ward tier on Guardians: the highest one reached by this Rupture Level (Ward 25 at RL 60, 35 at RL 80).
  // "Each Totem or Ballista past the first deals X% less damage" on an allocated node (Ancestral Host, Siege Pact)
  // or a unique line (a Signet granting one): the largest X, or 0.
  function totemPastFirstLess(GD, ch, off) {
    const re = /(?:Totem|Ballista) past the first deals (\d+)% less/i; let best = 0;
    const scan = t => { const m = re.exec(t || ''); if (m) best = Math.max(best, +m[1]); };
    if (!(off && off.has('passives'))) for (const id of ch.passives || []) {
      const n = GD.nodes[id] || GD.nodes[(GD.moved || {})[id]]; if (n) { scan(n.Text); scan(n.Price); }
    }
    for (const it of ch.items || []) {
      if (off && off.has('item:' + it.slot)) continue;
      const u = GD.uniques[lc(it.unique)]; if (u) for (const um of u.Mods || []) scan(um.Text);
    }
    return best;
  }
  function wardAt(GD, rl) { let w = 0; for (const t of GD.ward || []) if (rl >= t.fromRL) w = t.resist; return w; }
  // A Guardian's colour variant resistance to an element (bosses.json); 40 when unknown (the most common).
  function guardianVariantResist(GD, guardianId, element) { const g = (GD.guardians || {})[guardianId]; const v = g && g.variants.find(x => x.element === element); return v ? v.resist : 40; }
  function runewordPower(rw, itemLevel) {
    const lv = rw.PowerBandILvl || [], cnt = rw.PowerBandCount || [];
    let band = -1; for (let i = 0; i < lv.length; i++) if ((itemLevel || 0) >= lv[i]) band = i;
    if (band < 0 || !rw.PowerBandMods) return { mods: rw.PowerMods || [], band: 0 };
    const from = cnt.slice(0, band).reduce((x, y) => x + y, 0);
    return { mods: rw.PowerBandMods.slice(from, from + cnt[band]), band: lv[band] };
  }
  function runewordFor(GD, it, base) {
    if (!it.runes || !it.runes.length || !base) return null;
    const ids = it.runes.map(lc).join(',');
    const btags = new Set([...(base.Tags || []), base.Class, base.Slot].map(lc));
    return GD.runewords.find(w => w.Runes.map(lc).join(',') === ids && w.Bases.some(b => btags.has(lc(b)))) || null;
  }

  // ---------- helpers on the mod list ----------
  function makeCtx(GD, ch, sk, skillId, mainBase, offBase) {
    const tags = new Set();
    for (const t of sk.Tags || []) tags.add(lc(t));
    if (sk.Delivery) tags.add(lc(sk.Delivery));
    // Thousand Cuts (Mirage hops) counts as a Movement skill though its Tags leave Movement out, so Afterimage
    // and Afterimages skip it. Game log 4 Nov: "MoveCount79: ON - thousand_cuts count as Movement skills for
    // modifiers and supports (not for input)".
    if (sk.Mirage && sk.Mirage.Hops > 0) tags.add('movement');
    const isAttack = has(tags, 'Attack');
    const isGem = sk.Kind === 'Gem' || ch.gems.includes(skillId);
    if (isGem) tags.add('gem');
    const gear = new Set();
    for (const b of [mainBase, offBase]) if (b) for (const t of [...(b.Tags || []), b.Class]) gear.add(lc(t));
    if (mainBase && offBase && offBase.DamageMin) gear.add('dualwielding');
    if (offBase && lc(offBase.Class) === 'shield') gear.add('holdingshield');
    if (!mainBase) gear.add('martial');
    if (mainBase && ['fist', 'claw'].includes(lc(mainBase.Class))) gear.add('martial');
    return { tags, gear, isAttack, isSpell: has(tags, 'Spell'), dealt: new Set() };
  }

  function condsOk(ctx, conds) {
    for (const c of conds) {
      const t = lc(c);
      if (ctx.tags.has(t)) continue;
      if (t === 'dualwielding' || t === 'holdingshield') { if (ctx.gear.has(t)) continue; return false; }
      if (ctx.isAttack && ctx.gear.has(t)) continue; // weapon-kind lines (Bow, Staff, TwoHand ...) on attacks
      return false;
    }
    return true;
  }

  // Does this mod apply to the skill, and (for damage stats) to damage type d?
  function applies(ctx, m, d) {
    const { types, conds } = splitTags(m.tags);
    if (!condsOk(ctx, conds)) return false;
    if (d === undefined) {
      // Non-damage stat with element tags (e.g. "Lightning crit chance"): the skill must carry or deal that element.
      return !types.length || types.some(t => ctx.tags.has(lc(t)) || (ctx.carried || ctx.dealt).has(t));
    }
    return !types.length || types.includes(d);
  }

  function pickMods(mods, stat, mode) { return mods.filter(m => m.stat === stat && (!mode || m.mode === mode) && !m.local); }
  // Max mana: Hero ManaBase + ManaPerLevel x level + ManaPerInt x Int, + Mana lines, x increased Mana.
  function heroMaxMana(H, ch, mods, attr) {
    const flat = pickMods(mods, 'Mana', 'Flat').reduce((a, m) => a + m.v, 0), inc = pickMods(mods, 'Mana', 'Inc').reduce((a, m) => a + m.v, 0);
    return ((H.ManaBase || 40) + (H.ManaPerLevel || 6) * ch.level + (H.ManaPerInt || 0.5) * (attr.Int || 0) + flat) * Math.max(0, 1 + inc / 100);
  }

  // ---------- Channel Conduit ----------
  // A spell dropped on a channelling skill's Conduit "casts itself at the nearest enemy every 0.5 seconds
  // ... with this skill's other supports". The game log shows the casts land on the channel's ticks, and a
  // cast waits for the next tick once the interval has passed (no carry-over), so a cast comes every
  // ceil(interval / tick) ticks. force: true = use the first channel with a Conduit even without a saved
  // link (build codes do not record links), false = never.
  function conduitHost(GD, ch, skillId, mods, force) {
    if (force === false) return null;
    const sk = GD.skills[lc(skillId)];
    if (!sk || !(sk.Tags || []).includes('Spell') || (sk.Tags || []).includes('Attack')) return null;
    const granted = (mods || []).some(m => m.stat === 'GrantSupport' && (m.tags || []).some(t => lc(t) === 'channel_conduit'));
    const hosts = ch.sockets.filter(s => { const hs = GD.skills[lc(s.skill)]; return hs && hs.Channel && lc(s.skill) !== lc(skillId) && (granted || s.supports.some(x => lc(x) === 'channel_conduit')); });
    const linked = hosts.find(s => s.conduit && lc(s.conduit) === lc(skillId));
    const s = linked || (force === true ? hosts[0] : null);
    if (!s) return null;
    return { skill: s.skill, name: (GD.skills[lc(s.skill)] || {}).Name || s.skill, linked: !!linked, supports: s.supports.filter(x => lc(x) !== 'channel_conduit') };
  }
  // Cast on Crit: which attack's crits cast this spell (support text: "When one of your attacks lands a critical
  // hit, the spell this is socketed in casts itself ... In an attack instead, drop a spell on its link").
  //   link:   a skill whose socket holds Cast on Crit and links this spell (the save's link field, like Conduit)
  //   self:   Cast on Crit in the spell's own sockets; counted from the first attack on your bar
  //   chosen: o.cocSource, an attack picked on the page
  // Only attacks count: a spell holding it (Orbiting Hammers) fired a few times in a burst in the log, then never.
  function cocSource(GD, ch, skillId, selfSupports, o) {
    o = o || {};
    const isCoc = x => lc(String(x).replace('@granted', '')) === 'cast_on_crit';
    const atk = id => { const s = GD.skills[lc(id)]; return !!s && (s.Tags || []).includes('Attack') && !(s.Tags || []).includes('Movement') && !isSummon(s); };
    // A linked source can be any skill with a hit: spells too (Discord guide 1 Nov: Ember Bolt with Cast on Crit
    // shows "Casts Death Coil" in game; Shrimspins' Orbiting Hammers cast Judgement while the ring was up).
    const hits = id => { const s = GD.skills[lc(id)]; return !!s && !isSummon(s) && ((s.Tags || []).includes('Attack') || s.SpellMin > 0); };
    const linkS = ch.sockets.find(s => lc(s.skill) !== lc(skillId) && s.conduit && lc(s.conduit) === lc(skillId) && s.supports.some(isCoc));
    let src = null, mode = null;
    // Cast on Crit in this skill's own socket with another spell on its link: this skill's crits cast that spell,
    // so this skill is the source, not cast (log 5 Nov: "Trigger: Crit -> CastLinked venom_spark via death_coil").
    const own = ch.sockets.find(s => lc(s.skill) === lc(skillId));
    if (!o.cocSource && own && own.conduit && lc(own.conduit) !== lc(skillId) && own.supports.some(isCoc)) return { source: true, target: own.conduit, name: (GD.skills[lc(own.conduit)] || {}).Name || own.conduit };
    // An attack holding it with nothing linked (patch notes 5 Nov): "the attack strikes by itself when your other
    // attacks crit, at most once every 0.75 s for all such attacks, for 44% less damage. A triggered Rain drops one
    // wave." Source: the first other attack on your bar (or the one picked); the 0.75 s is shared by every such attack.
    // The attack itself may be a movement attack (Iaido Thrust); only the source must be a plain attack.
    const atkSelf = id => { const s = GD.skills[lc(id)]; return !!s && (s.Tags || []).includes('Attack') && !isSummon(s); };
    if (atkSelf(skillId)) {
      if (!(selfSupports || []).some(isCoc)) return null;
      const order = [...(ch.hotbar || []), ...ch.sockets.map(s => s.skill)].filter(Boolean);
      const src2 = o.cocSource || order.find(id => atk(id) && lc(id) !== lc(skillId)) || null;
      const unlinked = s => s.supports.some(isCoc) && !(s.conduit && lc(s.conduit) !== lc(s.skill)) && atkSelf(s.skill);
      const shared = Math.max(1, new Set(ch.sockets.filter(unlinked).map(s => lc(s.skill)).concat(lc(skillId))).size);
      return { skill: src2, name: src2 ? (GD.skills[lc(src2)] || {}).Name || src2 : null, mode: o.cocSource ? 'chosen' : 'self', attack: true, shared,
        counted: !!src2 && atk(src2) && lc(src2) !== lc(skillId) };
    }
    if (o.cocSource) { src = o.cocSource; mode = 'chosen'; }
    else if (linkS) { src = linkS.skill; mode = 'link'; }
    else if ((selfSupports || []).some(isCoc)) {
      const order = [...(ch.hotbar || []), ...ch.sockets.map(s => s.skill)].filter(Boolean);
      src = order.find(atk) || null; mode = 'self';
    }
    if (!mode) return null;
    // 0.56.5 (Cast on Crit text): spells casting themselves "take turns: at most one of them every 0.3 seconds", and every
    // Cast on Crit you have shares one 0.15 s clock. selfSpells: spells holding it with nothing linked; users: every socket holding it.
    const cocSockets = ch.sockets.filter(s => s.supports.some(isCoc));
    const selfSpells = Math.max(1, new Set(cocSockets.filter(s => !atkSelf(s.skill) && !(s.conduit && lc(s.conduit) !== lc(s.skill))).map(s => lc(s.skill)).concat(mode === 'self' ? [lc(skillId)] : [])).size);
    const users = Math.max(1, new Set(cocSockets.map(s => lc(s.skill))).size);
    return { skill: src, name: src ? (GD.skills[lc(src)] || {}).Name || src : null, mode, counted: !!src && (mode === 'self' ? atk(src) : hits(src)), selfSpells, users };
  }
  // Skills on the bar whose crits could cast a spell with Cast on Crit (for the page's picker): attacks and
  // spells with a hit, other than the spell itself.
  function cocAttacks(GD, ch, skillId) {
    const seen = new Set(skillId ? [lc(skillId)] : []), out = [];
    for (const id of [...(ch.hotbar || []), ...ch.sockets.map(s => s.skill)]) {
      const s = id && GD.skills[lc(id)];
      if (!s || seen.has(lc(id)) || isSummon(s) || (s.Tags || []).includes('Movement') || !((s.Tags || []).includes('Attack') || s.SpellMin > 0)) continue;
      seen.add(lc(id)); out.push({ id, name: s.Name, spell: !(s.Tags || []).includes('Attack') });
    }
    return out;
  }
  // Seconds between Conduit casts before ticks: the support's interval x every "ConduitInterval More" line.
  function conduitInterval(GD, mods) {
    const cc = GD.supports.channel_conduit || {};
    const base = ((cc.Mods || []).find(m => m.Stat === 'ConduitInterval') || {}).Value || 0.5;
    return mods.filter(m => m.stat === 'ConduitInterval' && m.mode === 'More').reduce((t, m) => t * Math.max(0.05, 1 + m.v / 100), base);
  }

  // ---------- the calculation ----------
  function calcSkill(GD, ch, skillId, o) {
    o = o || {};
    const H = GD.scaling.Hero, G = GD.scaling.Gem, A = GD.scaling.Ailments, M = GD.scaling.Monster;
    const sk = GD.skills[lc(skillId)];
    const res = { skillId, notes: [], used: new Map() };
    if (!sk) return Object.assign(res, { error: 'Unknown skill ' + skillId });
    res.skill = sk;
    if (isSummon(sk) && !(sk.Minion && sk.Minion.MonsterId && sk.SpellMin)) return Object.assign(res, { unsupported: 'This summon has no damage of its own to count.' });
    const isAttack = (sk.Tags || []).includes('Attack');
    if (!sk.SpellMin && !isAttack) return Object.assign(res, { unsupported: 'This skill has no hit of its own (a buff, curse, Vow or movement skill). Its effects show up on your damage skills.' });

    const mainItem = ch.items.find(i => i.slot === 'MainHand');
    const offItem = ch.items.find(i => i.slot === 'OffHand');
    const mainBase = mainItem && GD.bases[lc(mainItem.base)];
    const offBase = offItem && GD.bases[lc(offItem.base)];
    const ctx = makeCtx(GD, ch, sk, skillId, mainBase, offBase);
    const isSpell = ctx.isSpell && !isAttack;

    // Gather mods: character-wide + this skill's supports (+ supports granted by passives/uniques).
    const col = o._col || collectMods(GD, ch, o); // _col: reuse when only supports change (search)
    res.notes.push(...col.notes);
    res.sources = col.sources;
    let mods = col.mods.slice();
    const socket = ch.sockets.find(s => s.skill === skillId);
    const host = conduitHost(GD, ch, skillId, col.mods, o.conduit);
    if (host) ctx.tags.add('conduit'); // Wake of Spells: "Conduit spells deal 10% less damage"
    const hostSk = host && GD.skills[lc(host.skill)];
    const hostTags = hostSk ? new Set([...(hostSk.Tags || []), hostSk.Delivery].map(lc)) : null;
    const supportList = (o.supportsOverride || (host ? host.supports : (socket ? socket.supports : []))).slice();
    for (const m of mods) if (m.stat === 'GrantSupport') {
      const sid = (m.tags || []).find(t => GD.supports[lc(t)]);
      // Once per support, however many lines grant it: Meteor Lore has three Skyfall lines (Projectile, Chain,
      // Nova). Storm Spark tooltip 4 Nov: Lightning 2,630-8,546 matches one Skyfall's 20% more, not three.
      if (!sid || supportList.some(s => lc(s.replace('@granted', '')) === lc(sid))) continue;
      // The grant line names the kinds it covers ("Projectile Spell", "Chain Spell", "Nova Spell"): the skill must
      // have all of them. Ember Spark (Spell Fire Brand Duration, no Chain) is not granted Skyfall: its tooltip
      // 9 Nov lists no Skyfall and no "Scales with Skyfall", and the log's "Your Skyfall skills" list (TrustFix91,
      // 9 Nov 12:48-14:54) names Storm, Rime and Venom Spark but never Ember Spark.
      if ((m.tags || []).some(t => lc(t) !== lc(sid) && !ctx.tags.has(lc(t)))) continue;
      // A granted Skyfall is dropped when the skill already has a socketed shape (Orbit, Rain, Trap, Totem):
      // log 4-5 Nov "Grant62: death_coil Skyfall lost to a socketed transform" (Orbit socketed), and the
      // Death Coil tooltip 5 Nov lists no Skyfall; its 20% more was the gap to the game's hit.
      if (lc(sid) === 'skyfall' && supportList.some(s => ['orbit', 'rain_support', 'trap_support', 'totem_support'].includes(lc(s)))) {
        res.notes.push('Skyfall (granted) is lost: this skill already has a socketed shape (game log "lost to a socketed transform").');
        continue;
      }
      supportList.push(sid + '@granted');
    }
    res.supports = [];
    const totemAttack = !!(sk.Totem && sk.Totem.Interval > 0 && isAttack);
    for (const raw of supportList) {
      const granted = raw.endsWith('@granted'); const id = raw.replace('@granted', '');
      const sd = GD.supports[lc(id)];
      const key = 'support:' + lc(id);
      if (!sd) { res.supports.push({ id, key, name: id, ok: false, why: 'unknown support' }); continue; }
      const req = sd.RequiresAnyTag || [];
      // Ballista-type totems take Trap and Skyfall although both list Totem under ExcludeTags. Ballista tooltip
      // 5 Nov (gem 20+11, Rupture 145): Trap Support and Skyfall Support shown active, "Scales with ... Trap,
      // Skyfall", log "summon_ballista delivery Totem transform Trap of [Trap,Skyfall]"; the hit ranges fit only
      // with Trap's 50% more and the Trap/Skyfall lines counted.
      const ex = (sd.ExcludeTags || []).filter(t => !(totemAttack && lc(t) === 'totem' && ['trap_support', 'skyfall'].includes(lc(id))));
      const ok = (!req.length || req.some(t => ctx.tags.has(lc(t)))) && !ex.some(t => ctx.tags.has(lc(t))) && !noFit(sd, sk);
      // In a Conduit, a support that only fits the channel (Faster Attacks on Cyclone) still works there:
      // it changes the channel's ticks, which sets the cast rate below.
      // A support granted by a passive or item that does not fit this skill just doesn't apply: don't list it.
      const fitsSelf = (!req.length || req.some(t => ctx.tags.has(lc(t)))) && !ex.some(t => ctx.tags.has(lc(t)));
      if (granted && !fitsSelf) continue;
      const fitsHost = hostTags && (!req.length || req.some(t => hostTags.has(lc(t)))) && !ex.some(t => hostTags.has(lc(t)));
      if (hostTags && !granted && !fitsHost) { res.supports.push({ id, key, name: sd.Name, ok: false, why: 'cannot be socketed in ' + host.name + ' (needs ' + req.join(' or ') + ')', desc: sd.Description }); continue; }
      const onHost = !ok && fitsHost && !granted;
      if (onHost) { res.supports.push({ id, key, name: sd.Name + ' (on ' + host.name + ')', ok: true, hostOnly: true, why: '', desc: 'Works on ' + host.name + ' itself; for this spell it only matters through ' + host.name + '\'s ticks. ' + sd.Description }); continue; }
      res.supports.push({ id, key, name: sd.Name + (granted ? ' (granted)' : ''), granted, ok, why: ok ? '' : brandTrapMiss(sd, sk) ? 'cannot be thrown as a trap: Brands cannot take it' : meleeOnlyMiss(sd, sk) ? 'the minions of ' + sk.Name + ' cannot use it (melee minions only)' : 'does not support this skill (' + (ex.some(t => ctx.tags.has(lc(t))) ? 'not for ' + ex.filter(t => ctx.tags.has(lc(t))).join(' or ') + ' skills' : 'needs ' + req.join(' or ')) + ')', desc: sd.Description });
      if (!ok || (o.off && o.off.has(key))) continue;
      for (const m of sd.Mods || []) mods.push({ stat: m.Stat, mode: m.Mode, tags: m.Tags || [], v: m.Value || 0, v2: m.Value2 || 0, local: false, src: 'Support · ' + sd.Name, key });
    }
    // Spellblade keystone: "Spell Damage modifiers also apply to Attacks": the Spell damage lines (Skyfall's 20%
    // more included), the hero's Int spell damage and Boundless Mind (both in the scaling below). Ballista swap
    // tests 5 Nov (camp, no Bloodlust): taking the Signet off drops every element to 46.85% of the hit (Lightning
    // 19,037-114,224 -> 8,918-53,510); all four parts together give 46.5%, any three of them 55% or more.
    // Thunderfall, patch 0.56.0 notes: "spell damage modifiers apply to it", the same rule as Spellblade for this
    // one attack (taken from its text when the text says so, else from the notes with 0.56 data).
    const spellDamageAttack = isAttack && (/spell damage modifiers (also )?apply/i.test(sk.Description || '') || (lc(skillId) === 'thunderfall' && is056(GD)));
    if (spellDamageAttack) res.notes.push(sk.Name + ': spell damage modifiers apply to it (patch 0.56), as with Spellblade.');
    const spellblade = isAttack && (spellDamageAttack || mods.some(m => m.stat === 'Keystone' && (m.tags || []).includes('Spellblade')));
    if (spellblade) {
      for (const m of mods.slice()) if (m.stat === 'Damage' && (m.tags || []).includes('Spell'))
        mods.push(Object.assign({}, m, { tags: m.tags.map(t => t === 'Spell' ? 'Attack' : t), src: m.src + ' (Spellblade)' }));
    }
    res.mods = mods;
    const use = (m, why) => { res.used.set(m, why || true); };
    // Cast on Crit: the spell is cast by an attack's crits (rate worked out below); it deals TrigDamage less.
    const coc = (isSpell || isAttack) && o.coc !== false ? cocSource(GD, ch, skillId, res.supports.filter(s => s.ok && !(o.off && o.off.has(s.key))).map(s => s.id), o) : null;
    if (coc && coc.counted) {
      ctx.tags.add('triggered');
      const own = mods.filter(m => m.stat === 'TrigDamage' && m.mode === 'More');
      const cs = GD.supports.cast_on_crit || {};
      const lines = own.length ? own : (cs.Mods || []).filter(m => m.Stat === 'TrigDamage').map(m => ({ stat: 'TrigDamage', mode: 'More', tags: [], v: m.Value, v2: 0, local: false, src: 'Support · ' + (cs.Name || 'Cast on Crit') + ' (on ' + coc.name + ')', key: 'support:cast_on_crit' }));
      for (const m of lines) { use(m, 'triggered damage'); mods.push(Object.assign({}, m, { stat: 'Damage', tags: [] })); }
      for (const m of mods) if (m.stat === 'TrigCooldown') use(m, 'trigger cooldown');
      // An attack triggered with nothing linked: "for a further 44% less damage" (support text, patch 5 Nov).
      if (coc.attack) mods.push({ stat: 'Damage', mode: 'More', tags: [], v: COC_ATTACK_LESS, v2: 0, local: false, src: 'Support · ' + (cs.Name || 'Cast on Crit') + ' (attack strikes by itself)', key: 'support:cast_on_crit' });
    }
    // The active shape support gives the skill its tag: Death Coil with Orbit "scales with ... Orbit"
    // damage (game tooltip), so "increased Orbit damage" lines apply.
    const SHAPE_TAG = { orbit: 'orbit', skyfall: 'skyfall', rain_support: 'rain', trap_support: 'trap', totem_support: 'totem' };
    const shapeId = res.supports.filter(s => s.ok && !(o.off && o.off.has(s.key))).map(s => lc(s.id)).find(id => SHAPE_TAG[id]) || null;
    if (shapeId) ctx.tags.add(SHAPE_TAG[shapeId]);
    // Chain Reaction: "5% less damage to the first target hit by a Chain" (Damage More -5 [FirstTarget]). Against one
    // enemy every hit of a Chain skill lands on its first target (node text, build 26551640).
    if (ctx.tags.has('chain')) ctx.tags.add('firsttarget');
    // A ballista with Trap and Skyfall scales with both (tooltip 5 Nov: "Scales with ... Trap, Skyfall").
    if (totemAttack) for (const s of res.supports) if (s.ok && !(o.off && o.off.has(s.key)) && ['trap_support', 'skyfall'].includes(lc(s.id))) ctx.tags.add(SHAPE_TAG[lc(s.id)]);
    // Dragonling Ascendancy rules that change combat but not the stat sheet.
    const ascFlag = f => mods.some(m => m.stat === 'Dragonling' && (m.tags || []).includes(f));
    const virulence = ascFlag('Asc71_Virulence') ? (GD.dragon.rules || {}).Virulence || { Cap: 60, DurMult: 0.75 } : null;
    // Mark of the Siege (ascended Watch Wyrm): "Your Ballistas deal 30% more damage to the enemy you last hit
    // yourself". Counted as if you keep hitting the target; its "own hits 10% less" is left out (the 76 rules drop it).
    if (ascFlag('Asc71_MarkOfSiege') && sk.Totem && sk.Totem.Kind === 'Ballista' && o.markOfSiege !== false) {
      const ms = (GD.dragon.rules || {}).MarkOfSiege || { More: 30 };
      mods.push({ stat: 'Damage', mode: 'More', tags: [], v: ms.More || 30, v2: 0, local: false, src: 'Dragonling · Mark of the Siege', key: 'dragon:mark_of_siege' });
      res.notes.push('Mark of the Siege: Ballistas deal ' + (ms.More || 30) + '% more to the enemy you last hit yourself (counted as if you keep hitting it).');
    }

    // Flashfire (ascended Pyromancer): "Your Fire hits in the 2 s after you use Flame Dash deal 40% more damage".
    // Log 9 Nov 2026 16:17-16:18: every Flame Dash logs "AscB72: Flashfire - flame_dash opens the window", and the Ember
    // Spark strikes after it log "Flashfire ember_spark on <monster>: x1.40" (18 lines, all x1.40; checked per strike, not
    // per cast). Counted as if a Flame Dash is always in the last 2 s (o.flashfire), so it is an upper bound.
    if (ascFlag('Asc71_Flashfire') && o.flashfire) {
      const ff = (GD.dragon.rules || {}).Flashfire || { Window: 2, More: 40 };
      mods.push({ stat: 'Damage', mode: 'More', tags: ['Fire'], v: ff.More || 40, v2: 0, local: false, src: 'Dragonling · Flashfire', key: 'dragon:flashfire' });
      res.notes.push('Flashfire: Fire hits in the ' + (ff.Window || 2) + ' s after a Flame Dash deal ' + (ff.More || 40) + '% more (counted as if you dash every ' + (ff.Window || 2) + ' s).');
    }

    // Attributes.
    const cls = GD.classes[lc(ch.classId)] || {};
    const attr = {};
    for (const a of ['Str', 'Dex', 'Int']) {
      let flat = (cls[a] || 0) + (cls[a + 'PerLevel'] || 0) * Math.max(0, ch.level - 1);
      let inc = 0;
      for (const m of mods) {
        if (m.stat === a || m.stat === 'Attributes') {
          if (m.mode === 'Flat') { flat += m.v; use(m); } else if (m.mode === 'Inc') { inc += m.v; use(m); }
        }
      }
      attr[a] = Math.floor(flat * (1 + inc / 100));
    }
    res.attr = attr;
    const per10 = (a, k) => attr[a] / 10 * (H[k] || 0); // not rounded down (Shrimpbow tooltips: 107 Dex = +10.7% attack speed, 52 Int = 4.21 s bleed)
    // Mountainborn: "{v}% more Melee Physical Damage for every 10 Strength" (one more multiplier, unrounded like
    // the other per-10 rules).
    // Patch 0.56.0 notes: "Mountainborn (Warrior keystone) works with every Physical Attack: every 10 Strength gives
    // 1.75% more Physical Attack damage (was 1% Melee only)" (the 1.75 comes from the data).
    const mountainAll = is056(GD);
    // 0.56.5 notes: "Stat engines (Hammer of Judgement, Mountainborn, Boundless Mind, Thousand Feathers, Bloodlust and more)
    // add together instead of multiplying each other." Ironclad Fury's text (build 26543267): "It adds into the same damage
    // engine as the passive tree's lines that pay your defences." Engine lines are collected here and summed into one
    // more multiplier just before the scaling (see engineCollapse below).
    const engine0565 = is0565(GD);
    const engine = [];
    for (const m of mods.filter(m => m.stat === 'StrMeleeMore' && m.mode === 'Flat')) {
      if (!isAttack || (!mountainAll && !ctx.tags.has('melee'))) continue;
      use(m, 'more per 10 Strength');
      let strSteps;
      if (engine0565) {
        // Node text in build 26543267: "1.75% more Physical Attack damage, up to 300 Strength, and 0.5% more for every 10 above that."
        const nt = /up to (\d+) Strength, and ([\d.]+)% more for every 10 above/i.exec(((GD.nodes || {}).r59_mountain_k3 || {}).Text || '');
        const cap = nt ? +nt[1] : 300, past = nt ? +nt[2] : 0.5;
        strSteps = Math.min(attr.Str, cap) / 10 + Math.max(0, attr.Str - cap) / 10 * (past / m.v);
      } else {
        // 0.56.4 notes + node text: "1.75% more ... for every 10 Strength, up to 500 Strength, and 0.75% more for every 10 above that."
        strSteps = is0564(GD) ? Math.min(attr.Str, 500) / 10 + Math.max(0, attr.Str - 500) / 10 * (0.75 / m.v) : attr.Str / 10;
      }
      const line = { stat: 'Damage', mode: 'More', tags: ['Physical', mountainAll ? 'Attack' : 'Melee'], v: m.v * strSteps, v2: 0, local: false, src: m.src + ' (' + attr.Str + ' Str)', key: m.key };
      if (engine0565) engine.push({ v: line.v, types: ['Physical'], src: line.src }); else mods.push(line);
    }
    // 0.56.5 defence engine: "{v}% more Damage for every 1,000 Armour / Evasion / maximum Energy Shield / maximum Life" and
    // "for every 1% Chance to Block". Past 12,000 Armour or Evasion, 6,000 Energy Shield or 5,000 Life each 1,000 counts a
    // quarter (Ironclad Fury, Bastion's Reckoning and node texts, build 26543267). Hammer of Judgement is the same rule:
    // "8% ... up to 12,000 Armour, and 2% more for every 1,000 above that". The defences are ESTIMATED from gear, tree and
    // attributes (defenceTotal); not checked against the game's character panel.
    const DEF_ENGINE = { ArmourMore: ['Armour', 12000], EvasionMore: ['Evasion', 12000], EnergyShieldMore: ['EnergyShield', 6000], LifeMore: ['Life', 5000], BlockMore: ['Block', 0] };
    if (engine0565) {
      const tot = {}, get = s => tot[s] != null ? tot[s] : (tot[s] = defenceTotal(GD, ch, mods, attr, s));
      const label = { Armour: 'armour', Evasion: 'evasion', EnergyShield: 'energy shield', Life: 'life', Block: '% block' };
      for (const m of mods.filter(m => DEF_ENGINE[m.stat] && m.mode === 'Flat' && !m.local)) {
        if (!applies(ctx, m)) continue;
        const [s, knee] = DEF_ENGINE[m.stat], t = get(s);
        const units = s === 'Block' ? t : (Math.min(t, knee) + Math.max(0, t - knee) / 4) / 1000;
        use(m, s === 'Block' ? 'more per 1% block' : 'more per 1,000 ' + label[s]);
        engine.push({ v: m.v * units, types: splitTags(m.tags).types, src: m.src + ' (' + Math.round(t).toLocaleString('en-US') + (s === 'Block' ? '' : ' ') + label[s] + ', estimated)' });
      }
      // Rampart Strike support (0.56.5): "The linked Shield attack deals {v}% more Damage for each 1% chance to Block". Its
      // text does not put it in the engine, so it is its own more multiplier.
      for (const m of pickMods(mods, 'BlockToDamage', 'Flat')) if (applies(ctx, m) && ctx.tags.has('shield')) {
        const b = get('Block'); use(m, 'more per 1% block');
        mods.push({ stat: 'Damage', mode: 'More', tags: [], v: m.v * b, v2: 0, local: false, src: m.src + ' (' + Math.round(b) + '% block, estimated)', key: m.key });
      }
      // Oath of Many Fires: "You deal 2% more Fire damage for every 100 maximum Mana you have". The game puts it in the same
      // engine, unrounded: log 9 Nov 2026 21:16 "TrustFix91: engine now oath_of_many_fires ManaMore 2.0 x 8.27 (keystone)"
      // (827 mana). Max mana is the sim's estimate (the same as the mana check below).
      for (const m of pickMods(mods, 'ManaMore', 'Flat')) {
        const mana = heroMaxMana(H, ch, mods, attr);
        use(m, 'more per 100 mana');
        engine.push({ v: m.v * mana / 100, types: splitTags(m.tags).types, src: m.src + ' (~' + Math.round(mana) + ' mana, estimated)' });
      }
      // Oath of a Thousand Cuts: "Your Melee attacks and Orbit skills deal 4% more damage for every 10% increased Attack
      // Speed you have" (two lines, Melee and Orbit; one counts). Taken as an engine line, unrounded, like ManaMore in the
      // log above. Increased Attack Speed = your attack speed lines that suit an attack with this weapon + Dexterity's;
      // NOT CHECKED against the game.
      const speedLine = pickMods(mods, 'SpeedMore', 'Flat').find(m => applies(ctx, m));
      for (const m of pickMods(mods, 'SpeedMore', 'Flat')) if (m !== speedLine) use(m, 'counted once');
      if (speedLine) {
        const atkCtx = Object.assign({}, ctx, { tags: new Set([...ctx.tags, 'attack']), isAttack: true });
        let asInc = per10('Dex', 'DexAttackSpeedPer10');
        for (const m of pickMods(mods, 'AttackSpeed', 'Inc')) if (applies(atkCtx, m)) asInc += m.v;
        use(speedLine, 'more per 10% attack speed');
        engine.push({ v: speedLine.v * Math.max(0, asInc) / 10, types: [], src: speedLine.src + ' (' + Math.round(asInc) + '% increased Attack Speed)' });
      }
      const shown = Object.keys(tot).map(s => '~' + Math.round(tot[s]).toLocaleString('en-US') + (s === 'Block' ? '' : ' ') + label[s]);
      if (shown.length) res.notes.push('Defence engine: ' + shown.join(', ') + ' (estimated from your gear, tree and attributes; past 12,000 Armour/Evasion, 6,000 Energy Shield, 5,000 Life each 1,000 counts a quarter, patch 0.56.5).');
    }
    // Hammer of Judgement: "Your Slams deal 8% more damage for every 1,000 Armour you have, up to 20,000 Armour, and 3% more
    // for every 1,000 above that" (0.56.4 notes, 8 Nov 2026; before it the game text had no cap, here too). Armour is estimated:
    // each item's base armour + its local flat, x its local increases, plus global flat armour, x (global increased armour
    // and Defences + Strength's ${StrArmourPctPer10}% per 10). NOT CHECKED against the game's armour figure.
    const armourMods = mods.filter(m => m.stat === 'ArmourMore' && m.mode === 'Flat');
    if (!engine0565 && armourMods.length && isAttack && ctx.tags.has('slam')) {
      let flat = mods.filter(m => !m.local && m.stat === 'Armour' && m.mode === 'Flat').reduce((x, m) => x + m.v, 0);
      for (const it of ch.items) {
        const b = GD.bases[lc(it.base)]; if (!b || !b.Armour) continue;
        const key = 'item:' + it.slot, loc = mods.filter(m => m.local && m.key === key);
        const lf = loc.filter(m => m.stat === 'Armour' && m.mode === 'Flat').reduce((x, m) => x + m.v, 0);
        const li = loc.filter(m => m.mode === 'Inc' && (m.stat === 'Armour' || m.stat === 'Defences')).reduce((x, m) => x + m.v, 0);
        flat += (b.Armour + lf) * (1 + li / 100);
      }
      const gi = mods.filter(m => !m.local && m.mode === 'Inc' && (m.stat === 'Armour' || m.stat === 'Defences')).reduce((x, m) => x + m.v, 0) + (H.StrArmourPctPer10 || 0) * attr.Str / 10;
      const armourTotal = flat * (1 + gi / 100);
      for (const m of armourMods) {
        use(m, 'more per 1,000 armour');
        const k = is0564(GD) ? Math.min(armourTotal, 20000) / 1000 + Math.max(0, armourTotal - 20000) / 1000 * 3 / m.v : armourTotal / 1000;
        mods.push({ stat: 'Damage', mode: 'More', tags: [], v: m.v * k, v2: 0, local: false, src: m.src + ' (' + Math.round(armourTotal).toLocaleString('en-US') + ' armour, estimated)', key: m.key });
      }
      res.notes.push('Hammer of Judgement: ~' + Math.round(armourTotal).toLocaleString('en-US') + ' armour (estimated from your gear and Strength).' + (is0564(GD) ? ' 8% per 1,000 up to 20,000, 3% above (patch 0.56.4).' : ''));
    }
    // Ruthless: every third blow deals RuthlessBlow% more Physical damage: averaged over the three blows.
    for (const m of mods.filter(m => m.stat === 'RuthlessBlow' && m.mode === 'Flat')) {
      use(m, 'averaged over 3 blows');
      mods.push({ stat: 'Damage', mode: 'More', tags: ['Physical'], v: m.v / 3, v2: 0, local: false, src: m.src + ' (every 3rd blow, averaged)', key: m.key });
    }

    // Gem level. Weapon and basic skills follow the hero (CharLevelForGemLevel).
    let own = o.gemLevel || ch.gemLevels[skillId];
    if (!own) { const t = G.CharLevelForGemLevel || []; own = 1; for (let i = 0; i < t.length; i++) if (ch.level >= t[i]) own = i + 1; }
    let bonus = 0;
    for (const m of mods) if (m.stat === 'SkillLevel' && m.mode === 'Flat') {
      const { types, conds } = splitTags(m.tags);
      if (condsOk(ctx, conds) && types.every(t => ctx.tags.has(lc(t)))) { bonus += m.v; use(m); }
    }
    bonus = Math.floor(bonus);
    const L = own + bonus;
    res.gem = { own, bonus, total: L };
    if (isSummon(sk)) return minionSheet(GD, ch, sk, res, mods, use, attr, L, o);
    if (sk.Minion) res.notes.push(sk.Name + ': enemies it kills rise as minions that fight for you; they are not counted here (only this skill\'s own hits).');

    // Effectiveness ramps: Early (low gem levels) and Late (from -> at), linear, read at the gem's OWN
    // level (gear levels do not move them). Calibrated 31 Oct against the game's log: Death Coil 20+7
    // hits 25.6k-36.9k and the skill panel's 967k DPS both fit this within 0.1%.
    const effAt = (baseEff) => {
      let e = baseEff;
      if (sk.EffectivenessLate != null && sk.EffectivenessLateAt) {
        const f = sk.EffectivenessLateFrom || 1, a = sk.EffectivenessLateAt;
        e = baseEff + (sk.EffectivenessLate - baseEff) * clamp(((o._lateOwn ? own : L) - f) / Math.max(1, a - f), 0, 1);
      }
      if (sk.EffectivenessEarly != null) {
        const h = sk.EffectivenessEarlyHold || 1, fu = sk.EffectivenessEarlyFull || h + 1;
        e *= sk.EffectivenessEarly + (1 - sk.EffectivenessEarly) * clamp(((o._lateOwn ? own : L) - h) / Math.max(1, fu - h), 0, 1);
      }
      return e;
    };

    // ----- base damage -----
    const parts = {}; DT.forEach(d => parts[d] = [0, 0]);
    const addPart = (d, a, b) => { parts[d][0] += a; parts[d][1] += b; };
    let weapon = null, spellGrowth = 1, attackMult = 1;
    if (isAttack) {
      // Rending Slam: "4% of your maximum life joins the weapon's base damage" (LifeAsBase). Game log 6 Nov,
      // Shrimpslam (572 life, Steel Greatsword 21-38, gem 8): unexposed Vampire Lord hits 4554 and 4746, afterimages
      // 1848 and 1884 (40%); without the life share the sheet tops out at 3299 (1320 for an afterimage), with it
      // 3525-5096. Whether local % physical on the weapon scales the life share is not checked (this sword has none).
      let lifeBase = 0;
      if (sk.LifeAsBase && mainBase && mainBase.DamageMin) {
        res.heroLife = heroMaxLife(GD, ch, mods, attr);
        lifeBase = res.heroLife * sk.LifeAsBase / 100;
        res.notes.push(sk.Name + ': ' + sk.LifeAsBase + '% of your ~' + Math.round(res.heroLife) + ' maximum life (+' + lifeBase.toFixed(1) + ') joins the weapon\'s base physical damage. Max life here counts level, Strength and life lines on gear and the tree (checked against the game log); temporary life buffs are not counted.');
      }
      weapon = weaponStats(GD, mainItem, mainBase, mods, use, lifeBase);
      const [fullB, fadedB] = bonusSplit(bonus);
      const levelFactor = (1 + (G.AttackEffectivenessPerLevel || 0) * (own - 1)) * (G.BonusLevelAttackMore > 0 ? Math.pow(G.BonusLevelAttackMore, fullB) : 1 + (G.AttackEffectivenessPerLevel || 0) * fullB) * Math.pow(BONUS_FADE_ATTACK, fadedB);
      attackMult = effAt(sk.Effectiveness != null ? sk.Effectiveness : 1) * levelFactor;
      for (const d of DT) addPart(d, weapon.dmg[d][0] * attackMult, weapon.dmg[d][1] * attackMult);
      res.base = { kind: 'attack', weapon, effectiveness: attackMult, levelFactor };
    } else {
      // Spells grow by the game-wide Gem.DamageGrowth (x1.19) per level, the first 5 gear levels included
      // (x1.06 each past +5, patch notes 5 Nov; was x1.04 from patch 0.55; the 0.56 curve with its data, see spellFade).
      // (The per-skill SpellGrowth field does not match the game's numbers; calibrated 31 Oct.)
      spellGrowth = spellLevelGrowth(G.DamageGrowth || (1 + (sk.SpellGrowth || 0)), own, bonus, spellFade(GD));
      const eff = effAt(1);
      const d = DT.includes(sk.DamageType) ? sk.DamageType : 'Physical';
      // Pyre of Faith (LifeAsBase 0.75): "damage that grows with your maximum life". Owner's tooltip, 10 Nov 2026
      // (gem 5, 3429 max life): Fire 12,315 to 13,921. 0.75% of 3429 = 25.72 added to the base 5.412-9.471:
      // (5.412+25.72) x 395.6 = 12,315 and (9.471+25.72) x 395.6 = 13,921, the same multiplier at both ends.
      // Assumed: the life share is levelled like the flat base (the min/max ratio cannot tell).
      let spellLife = 0;
      if (sk.LifeAsBase) {
        res.heroLife = heroMaxLife(GD, ch, mods, attr);
        spellLife = res.heroLife * sk.LifeAsBase / 100;
        res.notes.push(sk.Name + ': ' + sk.LifeAsBase + '% of your ~' + Math.round(res.heroLife) + ' maximum life (+' + spellLife.toFixed(1) + ') joins the spell\'s base damage (checked against the in-game tooltip, 10 Nov 2026).');
      }
      addPart(d, (sk.SpellMin + spellLife) * spellGrowth * eff, (sk.SpellMax + spellLife) * spellGrowth * eff);
      res.base = { kind: 'spell', min: sk.SpellMin, max: sk.SpellMax, growth: spellGrowth, effectiveness: eff };
      if (mainBase && lc(mainBase.Class) === 'staff') {
        // The staff's local "increased critical chance" lifts the staff's own base crit first (it was left out before).
        // Owner's Judgement tooltip, 9 Nov 2026: crit 76.6%. Astral Staff base 7 with local +49.4% (38 x Flawless Rare 1.3),
        // flat +3.5 (Arcane Precision 1.5, Sun-Struck Mind 1, Honed Edge 1), +450% increased elsewhere:
        // (7 x 1.494 + 3.5) x 5.5 = 76.8%; without the local line the sheet gave 57.75%.
        let ci = 0;
        if (mainItem) for (const m of mods) if (m.local && m.key === 'item:' + mainItem.slot && m.stat === 'CritChance' && m.mode === 'Inc') { ci += m.v; use(m, 'local'); }
        weapon = { crit: (mainBase.Crit || 0) * (1 + ci / 100), isStaff: true };
      }
    }
    // Added damage. Attacks: x effectiveness. Spells: x1, or grown like the gem when GemScaled.
    // Support gems' added damage ("scaled up by the skill's gem level") grows x1.19 a level (gear levels
    // included). Attacks also get their effectiveness on it (Cyclone tooltip 1 Nov: Added Lightning 1-6 ->
    // 724-4,346 at level 23 = x1.19^22 x the attack multiplier); spells do NOT (Unholy Void 700%: the game
    // adds only ~17k a hit for Added Lightning + Added Cold). Other added damage gets "effectiveness".
    // Gear levels past +5 grow it like a spell's (x1.04 each, patch 0.55), not x1.19: Ballista 20+11 swap tests
    // 5 Nov, Added Lightning 1-6 -> 19,037-114,224 fits 1.19^24 x 1.04^6 within 0.7% (1.19^30 was 2.26x over);
    // up to +5 it is the same 1.19^(L-1) as before (the Cyclone fit above).
    const gemGrowth = spellLevelGrowth(G.DamageGrowth || 1.19, own, bonus, BONUS_FADE_ADDED);
    for (const m of pickMods(mods, 'AddedDamage', 'Flat')) {
      const { types, conds, gemScaled } = splitTags(m.tags);
      if (!condsOk(ctx, conds) || !types.length) continue;
      const k = isAttack ? attackMult * (gemScaled ? gemGrowth : 1) : (gemScaled ? spellGrowth : effAt(1));
      addPart(types[0], m.v * k, m.v2 * k); use(m, 'adds ' + types[0]);
    }
    res.baseParts = clone(parts);

    // ----- conversion -----
    // Each piece of damage remembers which types' modifiers it scales with: converted damage keeps
    // the old type's modifiers and gains the new one's (the game's tooltip says so).
    // Tag rules (from item texts): [X] on an item = Physical converted to X; [X] on a support = other
    // damage to X (Zap/Flame/Ice: Poison at half); [X, cond...] = damage of skills with cond to X.
    let pieces = DT.filter(d => parts[d][1] > 0).map(d => ({ type: d, scales: new Set([d]), min: parts[d][0], max: parts[d][1] }));
    // An elemental attack converts ConvertShare of ALL its physical damage (weapon + added) to its element,
    // and the converted part keeps Physical modifiers too (Lightning Arrow tooltip 1 Nov: 44-97 Physical and
    // 44-97 Lightning, "Converted damage keeps your Physical modifiers and gains the new element's too").
    if (isAttack && sk.DamageType && sk.DamageType !== 'Physical' && DT.includes(sk.DamageType)) {
      const share = sk.ConvertShare != null ? (sk.ConvertShare > 1 ? sk.ConvertShare / 100 : sk.ConvertShare) : 1;
      const ph = pieces.find(p => p.type === 'Physical');
      if (ph && share > 0) {
        pieces.push({ type: sk.DamageType, scales: new Set(['Physical', sk.DamageType]), min: ph.min * share, max: ph.max * share });
        ph.min *= 1 - share; ph.max *= 1 - share;
        if (ph.max <= 0) pieces = pieces.filter(p => p !== ph);
      }
    }
    // All conversion lines apply at once to the original damage, each source type capped at 100%
    // (Unholy Void with Plaguewright's Grasp 50% + Venom 60% shows no Lightning or Cold left).
    // Poison converts at half into any other type (game rule "converts Poison at half").
    const convRules = [];
    for (const m of pickMods(mods, 'Convert', 'Flat')) {
      const tags = m.tags || [];
      const to = tags.find(t => DT.includes(t)); if (!to) continue;
      const rest = tags.filter(t => t !== to);
      if (!condsOk(ctx, rest)) continue;
      const fromSupport = /^Support/.test(m.src);
      let from;
      // [X, Y]: Y is a skill condition (checked above), and that skill's damage of every other type converts
      // to X; Poison at half (below). Patch 0.55 text: Plaguewright's Grasp "Poison Skills have 50% of other
      // Damage Converted to Physical", Stormfrost Band "Lightning Skills' Damage Converted to Cold". Venom Spark
      // tooltip 5 Nov with Plaguewright's: Added Cold 1,176-1,568 = half the sheet's 2,351-3,135, the other half
      // in Physical (1,798-3,747), and the Poison -> Physical part as before. (Before 0.55 only Poison converted.)
      if (rest.length) from = t => 1;
      else if (fromSupport) from = t => 1;
      else from = t => (t === 'Physical' ? 1 : 0);
      convRules.push({ to, pct: m.v, from }); use(m, 'conversion');
    }
    if (convRules.length) {
      const out = [];
      for (const p of pieces) {
        const shares = convRules.map(r => {
          if (r.to === p.type) return 0;
          let f = r.from(p.type); if (f && p.type === 'Poison') f = Math.min(f, 0.5);
          return r.pct * f / 100;
        });
        const tot = shares.reduce((a, b) => a + b, 0);
        const scale = tot > 1 ? 1 / tot : 1;
        const kept = 1 - Math.min(1, tot);
        if (kept > 0) out.push({ type: p.type, scales: p.scales, min: p.min * kept, max: p.max * kept });
        const byTo = {};
        convRules.forEach((r, i) => { if (shares[i] > 0) byTo[r.to] = (byTo[r.to] || 0) + shares[i] * scale; });
        // moreScales: "more" lines see only the element the damage came from (Storm Spark tooltips 9 Nov 2026, Flame Support +
        // supports added one at a time: with Oath of the Pyre's 15% more Fire counted on the Lightning that became Fire, the
        // sim's Fire was 1.10-1.15x the tooltip at every step while Lightning stayed at 0.976x; without it 1.04-1.05x).
        for (const [to, s] of Object.entries(byTo)) out.push({ type: to, scales: new Set([...p.scales, to]), moreScales: new Set(p.scales), min: p.min * s, max: p.max * s });
      }
      pieces = out;
    }
    // Extra damage (Heralds, "gain X% of Y as extra Z"): from the converted, unscaled hit; it scales with
    // the SOURCE piece's modifiers only, not the new type's (Cyclone tooltip 1 Nov: Physical as extra Fire
    // = 26% of the final Physical hit, no Fire / Elemental / Elemental Focus; Herald of Rime's Cold within
    // 0.1%). It still deals the new type (resistances and "taken" use it).
    // A converted piece also gains the extra lines of the type it came from ("Converted damage ... gains the new
    // element's too: both count"), except Poison's own "Poison as extra Poison". Venom Spark tooltip 5 Nov
    // (Added Cold half converted to Physical, Herald of Rot 23% Cold as extra Poison): Poison 3,599-10,276; the
    // sheet gives 3,481-10,071 this way, 3,211-9,710 without. Death Coil's Poison -> Physical part is unchanged.
    // 9 Nov 2026 (skill tooltips, level 58 Shrimpage, Herald of Embers 20 + Herald of Storms 16 on Ember Spark / Flame Dash /
    // Storm Spark): the extra Lightning from Herald of Storms scales with Lightning and generic lines, not with the Fire lines
    // of the hit it came from. With the source's scaling the sim gave Lightning 1.77x (Ember Spark) and 1.92x (Flame Dash)
    // the tooltip's 2,240-6,879 and 270-450; scaling it as its own element gives 0.995x and 0.996x. It matches the current
    // Herald text: "Scales with: the hit's own skill modifiers and your Fire and Elemental damage". The Fire the sim gave
    // was 3.4% short on both skills, which is what Herald of Embers' "Lightning as extra Fire" gives when it also counts the
    // extra Lightning, so the Fire extras are taken last, from the hit plus the other extras. (The 1 Nov Cyclone result
    // that an extra scales with its source only is from an earlier build.)
    const extras = [];
    const extraRules = [];
    for (const m of pickMods(mods, 'DamageAsExtra', 'Flat')) {
      const { types, conds } = splitTags(m.tags);
      if (!condsOk(ctx, conds) || !types.length) continue;
      extraRules.push({ m, to: types[types.length - 1], from: types.length >= 2 ? types[0] : null });
      use(m, 'extra ' + types[types.length - 1]);
    }
    const addExtras = (rules, sources) => {
      for (const { m, to, from } of rules) {
        for (const p of sources) if (!from || p.type === from || (p.scales.has(from) && from !== to)) extras.push({ type: to, scales: new Set([to]), min: p.min * m.v / 100, max: p.max * m.v / 100, from: p.type });
      }
    };
    addExtras(extraRules.filter(r => r.to !== 'Fire'), pieces);
    // The chain only where nothing is converted: Ember Spark / Flame Dash (no conversion) need it (+3.4% Fire, panel 0.997 and
    // 0.990 with it), Storm Spark with Flame Support (60% of its Lightning converted) fits without it (Fire 0.996-1.010 at
    // all five support steps, panel 0.993; with it 1.04). Why they differ is not known: this is a fit, not a found rule.
    addExtras(extraRules.filter(r => r.to === 'Fire'), pieces.some(p => p.moreScales) ? pieces : pieces.concat(extras.slice()));
    // Elements the skill itself carries (before Herald-style extra damage). Element-tagged non-damage lines ("Lightning
    // critical strike chance") look at these, not at extra damage: character panel 9 Nov 2026 (level 58, 69 points), Ember
    // Spark with Herald of Storms: crit 8.7% = 7 x 1.24 (Hunter's Mark +24%), the two Overcharge "Lightning crit +8%"
    // lines do not count even though the hit deals Lightning (the sim said 9.8%).
    ctx.carried = new Set(pieces.filter(p => p.max > 0).map(p => p.type));
    pieces = pieces.concat(extras);
    const noElem = mods.filter(isNoElem);
    if (noElem.length) {
      const lost = pieces.filter(p => ELEMENTS.includes(p.type));
      pieces = pieces.filter(p => !ELEMENTS.includes(p.type));
      noElem.forEach(m => use(m, 'no elemental damage'));
      if (lost.length) res.notes.push('Brutality: this skill deals no elemental damage, so its ' + [...new Set(lost.map(p => p.type))].join(', ') + ' part is lost (added, converted or extra). Supports that only add elemental damage do nothing beside it (the game shows them "idle").');
    }
    DT.forEach(d => parts[d] = [0, 0]);
    for (const p of pieces) addPart(p.type, p.min, p.max);
    res.convertedParts = clone(parts);
    DT.forEach(d => { if (parts[d][1] > 0) ctx.dealt.add(d); });

    // ----- scaling: each piece by the modifiers of every type it remembers -----
    const scaled = {}; const scaleInfo = {};
    const early = earlyDamage(cls, ch.level);
    const spellLike = ctx.isSpell || spellblade;
    const intSpell = spellLike ? per10('Int', 'IntSpellDamagePer10') : 0;
    // Boundless Mind: "Every 10 Intelligence also gives you 1% more Spell damage" (Spellblade carries it to
    // attacks: see above; with 501 Int it is x1.50 and the Signet test needs it).
    let intMore = 1;
    if (spellLike) for (const m of pickMods(mods, 'IntSpellMore', 'Flat')) {
      use(m, 'more spell damage per Int');
      if (engine0565) engine.push({ v: m.v * attr.Int / 10, types: [], src: m.src + ' (' + attr.Int + ' Int)' });
      else intMore *= 1 + m.v * attr.Int / 10 / 100;
    }
    // engineCollapse (0.56.5): Bloodlust joins the engine too, then every engine line is summed into one more multiplier.
    // A line held to one damage type (Mountainborn: Physical) adds to the sum only on that type: the untyped sum U goes on
    // every piece, and a Physical-only line S puts (1 + U + S) / (1 + U) on the Physical pieces.
    if (engine0565) {
      for (let i = mods.length - 1; i >= 0; i--) {
        const m = mods[i];
        if (m.key === 'charge:bloodlust' && m.stat === 'Damage' && m.mode === 'More') { engine.push({ v: m.v, types: splitTags(m.tags).types, src: m.src }); mods.splice(i, 1); }
      }
      if (engine.length) {
        const U = sum(engine.filter(e => !e.types.length).map(e => e.v));
        const byType = {};
        for (const e of engine) for (const t of e.types) byType[t] = (byType[t] || 0) + e.v;
        if (U) mods.push({ stat: 'Damage', mode: 'More', tags: [], v: U, v2: 0, local: false, src: 'Damage engine (added together, patch 0.56.5)', key: 'engine' });
        for (const [t, S] of Object.entries(byType)) mods.push({ stat: 'Damage', mode: 'More', tags: [t], v: ((1 + (U + S) / 100) / (1 + U / 100) - 1) * 100, v2: 0, local: false, src: 'Damage engine, ' + t + ' only (added together, patch 0.56.5)', key: 'engine' });
        res.engine = engine.map(e => ({ v: e.v, types: e.types, src: e.src }));
        if (engine.length > 1) res.notes.push('Damage engine (patch 0.56.5): ' + engine.map(e => e.src.replace(/^[^·]*·\s*/, '') + ' +' + e.v.toFixed(1) + '%' + (e.types.length ? ' (' + e.types.join(', ') + ' only)' : '')).join(', ') + ' add together = ' + (U + Math.max(0, ...Object.values(byType), 0)).toFixed(1) + '% more, instead of multiplying.');
      }
    }
    // Shield Throw (0.56.3): 1% increased damage per 5 armour + evasion + energy shield on the shield (base + local flat, x local increases).
    let shieldInc = 0;
    if (is0563(GD) && sk.Id === 'shield_throw' && offBase && offBase.Class === 'Shield') {
      const loc = mods.filter(m => m.local && m.key === 'item:OffHand');
      let total = 0;
      for (const st of ['Armour', 'Evasion', 'EnergyShield']) {
        const flat = loc.filter(m => m.stat === st && m.mode === 'Flat').reduce((x, m) => x + m.v, 0);
        const incp = loc.filter(m => m.mode === 'Inc' && (m.stat === st || m.stat === 'Defences')).reduce((x, m) => x + m.v, 0);
        total += ((offBase[st] || 0) + flat) * (1 + incp / 100);
      }
      shieldInc = total / 5;
      res.notes.push('Shield Throw: +' + Math.round(shieldInc) + '% increased damage from ' + Math.round(total) + ' armour, evasion and energy shield on your shield (patch 0.56.3).');
    }
    let kneeHit = 0;
    for (const p of pieces) {
      let inc = intSpell + shieldInc, more = intMore;
      const hits = m => { const { types, conds } = splitTags(m.tags); return condsOk(ctx, conds) && (!types.length || types.some(t => p.scales.has(t))); };
      const hitsMore = m => { const { types, conds } = splitTags(m.tags); return condsOk(ctx, conds) && (!types.length || types.some(t => (p.moreScales || p.scales).has(t))); };
      for (const m of pickMods(mods, 'Damage', 'Inc')) if (hits(m)) { inc += m.v; use(m); }
      for (const m of pickMods(mods, 'Damage', 'More')) if (hitsMore(m)) { more *= 1 + m.v / 100; use(m); }
      // 0.56.7 knee on the more multipliers of your own hits (the young-gem factor `early` stays outside it: my reading).
      if (is0567(GD) && more > 8) { kneeHit = Math.max(kneeHit, more); more = moreKnee(more); }
      more *= early;
      if (p.scales.has('Physical') && ctx.tags.has('melee')) inc += per10('Str', 'StrMeleePhysPer10');
      const k = Math.max(0, 1 + inc / 100) * more;
      const s = scaled[p.type] || (scaled[p.type] = [0, 0]);
      s[0] += p.min * k; s[1] += p.max * k;
      const si = scaleInfo[p.type] || (scaleInfo[p.type] = { base: 0, scaledAvg: 0 });
      si.base += (p.min + p.max) / 2; si.scaledAvg += (p.min + p.max) / 2 * k;
      if (!si.inc || (p.min + p.max) > (si._w || 0)) { si.inc = inc; si.more = more; si._w = p.min + p.max; }
    }
    if (kneeHit) res.notes.push('More damage knee (patch 0.56.7): your more multipliers reach x' + kneeHit.toFixed(2) + ', counted as x' + moreKnee(kneeHit).toFixed(2) + ' (full up to x8, each doubling past it adds x1.41).');
    for (const d of Object.keys(scaleInfo)) scaleInfo[d].k = scaleInfo[d].scaledAvg / scaleInfo[d].base;
    res.scaleInfo = scaleInfo;

    // ----- crit -----
    // Spells cast with a staff use the staff's own crit chance instead of the spell base (tooltip: 9% staff x 1.4 = 12.6%).
    let baseCrit = isAttack ? (weapon ? weapon.crit : H.CritBase) : (weapon && weapon.isStaff ? weapon.crit : H.SpellCritBase);
    let critFlat = 0, critInc = 0, critMore = 1, multi = H.CritMultiBase;
    for (const m of pickMods(mods, 'CritChance')) if (applies(ctx, m)) {
      if (m.mode === 'Flat') critFlat += m.v; else if (m.mode === 'Inc') critInc += m.v; else if (m.mode === 'More') critMore *= 1 + m.v / 100; use(m);
    }
    for (const m of pickMods(mods, 'CritMulti', 'Flat')) if (applies(ctx, m)) { multi += m.v; use(m); }
    const critChance = clamp((baseCrit + critFlat) * (1 + critInc / 100) * critMore, 0, 95);
    multi = Math.max(100, multi);
    // Elemental Overload (keystone, tooltip 9 Nov 2026): "Critical strikes grant 60% more elemental damage for 8 seconds.
    // Price: Your critical strike multiplier is 100%." The data line has no stat mods, only the text.
    const overload = !!(ch.passives && ch.passives.includes('elemental_overload'));
    if (overload) multi = 100;
    // Inevitable Judgement tooltip (6 Nov 2026): on Hallowed Ground, critical strikes keep twice their critical
    // bonus. Double only the bonus over a normal hit (e.g. 150% -> 200%), not the full critical multiplier.
    const hallowedCritBonus = ascFlag('Asc71_InevitableJudgement') && !!o.enemyHallowedGround;
    const effectiveMulti = hallowedCritBonus ? 100 + (multi - 100) * 2 : multi;
    const critFactor = 1 + critChance / 100 * (effectiveMulti / 100 - 1);
    res.crit = { base: baseCrit, chance: critChance, multi: effectiveMulti, factor: critFactor, inc: critInc };
    if (hallowedCritBonus) res.notes.push('Inevitable Judgement: critical strikes on this enemy keep twice their critical bonus (' + multi + '% becomes ' + effectiveMulti + '% critical damage).');

    // ----- speed -----
    let speedInc = 0, speedMore = 1;
    const speedStat = isAttack ? 'AttackSpeed' : 'CastSpeed';
    for (const m of pickMods(mods, speedStat)) if (applies(ctx, m)) {
      if (m.mode === 'Inc') speedInc += m.v; else if (m.mode === 'More') speedMore *= 1 + m.v / 100; use(m);
    }
    if (isAttack) speedInc += per10('Dex', 'DexAttackSpeedPer10');
    let rateMult = (1 + speedInc / 100) * speedMore * (sk.ActionSpeed || 1);
    rateMult = clamp(rateMult, H.ActionRateMin || 0, H.ActionRateMax || 99);
    const speedRate = rateMult; // attack/cast speed alone, before the clip's own Rate
    const META = (GD.scaling && GD.scaling.Meta) || {};
    // The skill's own animation speed (animsets.json Rate): the whole action plays that much faster.
    const animRate = ((GD.animRate || {})[lc(ch.classId)] || {})[skillId] || 1;
    const animOn = animRate !== 1 && !(sk.Channel && sk.Channel.Tick);
    if (animOn) rateMult *= animRate;
    let usesPerSec, useTime, countFactor = 1;
    if (sk.Channel && sk.Channel.Tick) { usesPerSec = rateMult / sk.Channel.Tick; useTime = sk.Channel.Tick / rateMult; }
    else if (isAttack) { const aps = weapon ? weapon.aps : 1.2; usesPerSec = aps * rateMult; useTime = 1 / usesPerSec; }
    else { const ct = sk.CastTime || 0.5; usesPerSec = rateMult / ct; useTime = ct / rateMult; }
    // Mirage (Thousand Cuts, skills.json Mirage): a use is one weapon swing at your attack speed (without the
    // skill's own ActionSpeed) plus Hops - 1 gaps of HopTime between the hops; the hop gap is not sped up.
    // Game log 4 Nov (Shrimptests, Samurai 18, Faster Attacks, ashen_wyrm ML16, 54 uses): "MirageHop" lines
    // 0.083 s apart (0.086 at lower speed), last hop to next use 0.375 s = 1 / (1.56 aps x 1.37 inc x 1.25
    // more), use to use 0.702 s; boss 18018 life in 36.5 s = 494 DPS vs this model's ~497.
    // Check report #3 (4 Nov, Samurai 40): the old "one swing at weapon speed x ActionSpeed" model gave
    // 5.28 uses/s and ran about 2x the real Guardian DPS (median real/sheet 0.53).
    const mirage = isAttack && sk.Mirage && sk.Mirage.Hops > 0 ? sk.Mirage : null;
    if (mirage && !(sk.Channel && sk.Channel.Tick)) {
      const aps = weapon ? weapon.aps : 1.2;
      const swing = 1 / (aps * rateMult / (sk.ActionSpeed || 1));
      const gap = mirage.HopTime || 0.09, hops = (mirage.Hops - 1) * gap;
      useTime = swing + hops; usesPerSec = 1 / useTime;
      res.notes.push(sk.Name + ': one swing at your attack speed (' + swing.toFixed(2) + ' s) plus ' + (mirage.Hops - 1) + ' gaps of ' + gap + ' s between its ' + mirage.Hops + ' hops (' + hops.toFixed(2) + ' s, not sped up by attack speed): ' + useTime.toFixed(2) + ' s per use.');
    }
    // Speed cap: a clip plays at most ActionRateMax (4x) its own speed, so each skill has a shortest use
    // time; past it more speed adds nothing (game tooltip "2.86 (speed cap)"). Clip lengths are not in the
    // data files, so only floors measured in the game are known (CLIP_FLOOR).
    const floor = (CLIP_FLOOR[lc(ch.classId)] || {})[skillId];
    if (floor && !(sk.Channel && sk.Channel.Tick) && useTime < floor) {
      res.notes.push('Speed cap: ' + skillId.replace(/_/g, ' ') + ' can\'t be used faster than once per ' + floor + ' s (' + (1 / floor).toFixed(2) + ' a second; the game\'s animation plays at most ' + (H.ActionRateMax || 4) + 'x its speed). You have ' + usesPerSec.toFixed(2) + ' a second of speed, so more attack speed adds nothing to this skill.');
      usesPerSec = 1 / floor; useTime = floor; res.speedCapped = true;
    }
    const animUses = animOn ? usesPerSec : null;
    let cooldown = 0;
    if (sk.Cooldown > 0) {
      let cdInc = 0;
      for (const m of pickMods(mods, 'Cooldown', 'Inc')) if (applies(ctx, m)) { cdInc += m.v; use(m); }
      // Late cooldown (data: CooldownLate from gem level CooldownLateAt, counting the +levels from gear and passives).
      // Flame Dash tooltip 9 Nov 2026 (gem 17 + 3 = level 20, Swift Step -40%): Cooldown 0.3 s = 0.5 x 0.6, 3.33 casts a
      // second; the sim used the level-1 1.2 s and said 1.67.
      const cdBase = sk.CooldownLate > 0 && sk.CooldownLateAt && res.gem && res.gem.total >= sk.CooldownLateAt ? sk.CooldownLate : sk.Cooldown;
      // No floor here: the game shows 0.3 s although MinCooldown is 0.5 (the floor only limits speed recovery below).
      cooldown = cdBase * Math.max(0.1, 1 + cdInc / 100);
      const cdBeforeSpeed = cooldown;
      // scaling.json Meta59 bRainCooldownBySpeed: a Rain attack's cooldown recovers with attack speed, down to
      // RainCooldownFloor (Rain of Arrows tooltip: 0.8 s at 1.65 APS on a 1.31 bow -> 0.64 s, 1.57 uses/s).
      if (META.bRainCooldownBySpeed && isAttack && sk.Delivery === 'Rain') {
        cooldown = Math.max(META.RainCooldownFloor || 0, cooldown / speedRate);
        res.notes.push('Rain cooldown recovers with attack speed: ' + cooldown.toFixed(2) + ' s (at least ' + (META.RainCooldownFloor || 0) + ' s).');
      }
      // A Spark's cooldown recovers with cast speed. Storm Spark tooltip 4 Nov (38% increased cast speed):
      // cast time 0.36 s (0.5 / 1.38), "Cooldown 1.1 s" (1.5 / 1.38 = 1.09), "Casts per second 0.92"; the log's
      // fastest recasts are 1.09 s apart.
      if (!isAttack && sk.Delivery === 'Brand' && speedRate > 0) {
        cooldown = cooldown / Math.max(speedRate, 1); // a cast speed under 1 does not lengthen it (Ember Spark tooltip 10 Nov: 1.0 s at x0.97)
        res.notes.push('Spark cooldown recovers with cast speed: ' + cooldown.toFixed(2) + ' s.');
      }
      // 0.56.2: every other cooldown recovers with attack or cast speed too (patch notes 7 Nov; Rain and Sparks above already did).
      if (is0562(GD) && !(META.bRainCooldownBySpeed && isAttack && sk.Delivery === 'Rain') && !(!isAttack && sk.Delivery === 'Brand') && speedRate > 0) {
        // The floor never lifts a cooldown above what it was before cast speed (Flame Dash shows 0.3 s with MinCooldown 0.5).
        cooldown = Math.max(Math.min(sk.MinCooldown || 0, cdBeforeSpeed), cooldown / speedRate);
        res.notes.push('Cooldown recovers with ' + (isAttack ? 'attack' : 'cast') + ' speed: ' + cooldown.toFixed(2) + ' s.');
      }
      usesPerSec = Math.min(usesPerSec, 1 / cooldown);
    }
    // Shape supports: a skill takes one shape, the first of these socketed (Skyfall's text). The others
    // only add their damage lines.
    const SHAPES = ['orbit', 'skyfall', 'rain_support', 'trap_support', 'totem_support'];
    const activeSup = res.supports.filter(s => s.ok && !(o.off && o.off.has(s.key))).map(s => lc(s.id));
    const shape = activeSup.find(id => SHAPES.includes(id)) || null;
    res.shape = shape;
    if (shape === 'totem_support') {
      const t = /every ([\d.]+) seconds/i.exec(GD.supports.totem_support.Description); const every = t ? +t[1] : 0.8;
      // Totem count set by hand (owner request, 9 Nov 2026): no game data on how many spell totems stand, so the
      // default stays one. The cap of 10 Totems is from the 0.56.2 patch notes (7 Nov).
      let tcount = Math.max(1, Math.floor(o.totemCount || 1));
      if (is0562(GD)) tcount = Math.min(tcount, 10);
      // Totem speed also speeds a Spell Totem's casts (owner's Judgement tooltip, 9 Nov 2026: "10 totems, each casting it
      // every 0.36 s" and "Casts per second 2.78" per totem, from the gem's 0.8 s; the build's +134.9% increased
      // totem speed gives 0.8 / 2.349 = 0.341 s, close to the shown 0.36 s, so the sum may include a line that does not apply).
      let tsInc = 0; for (const m of pickMods(mods, 'TotemSpeed', 'Inc')) if (applies(ctx, m)) { tsInc += m.v; use(m); }
      const baseEvery = every, spellEvery = baseEvery / Math.max(0.1, 1 + tsInc / 100);
      usesPerSec = tcount / spellEvery; useTime = 1 / usesPerSec;
      res.totem = { count: tcount, every: spellEvery };
      res.notes.push('Totem: ' + tcount + ' totem' + (tcount > 1 ? 's' : '') + ', each casting it every ' + spellEvery.toFixed(2) + ' s' + (tsInc ? ' (' + baseEvery + ' s with ' + Math.round(tsInc) + '% increased totem speed)' : '') + '; your cast speed only places totems faster; assumes every totem casts at this enemy.');
      // 0.56.5: totems of one skill share their damage (80% each past the first, 20% past the sixth).
      if (is0565(GD) && tcount > 1) {
        countFactor = countShare(tcount, 0.8, 0.2);
        res.notes.push('Totems share their damage (patch 0.56.5): each past the first adds 80% of one, past the sixth 20% (x' + countFactor.toFixed(3) + ' on average over ' + tcount + ').');
      }
    } else if (shape === 'trap_support' && !totemAttack) { // a ballista keeps its totem rate (below): tooltip 5 Nov "8 totems, each firing every 0.31 s" with Trap Support
      const d = GD.supports.trap_support.Description; const n = /up to (\d+)/i.exec(d), re = /re-arms ([\d.]+) seconds/i.exec(d);
      // 0.56.5 text: "it re-arms about a second later (sooner with faster re-arm)" (was "a moment later": 2.5 s assumed).
      let rearm = re ? +re[1] : /re-arms about a second/i.test(d) ? 1 : 2.5; let traps = n ? +n[1] : 3;
      // "+N to maximum Traps" lines (TrapCount) count from 0.56.5 on, where the extra traps' share is in the text.
      if (is0565(GD)) for (const m of pickMods(mods, 'TrapCount', 'Flat')) if (applies(ctx, m)) { traps += m.v; use(m); }
      // 0.56.4: "Trap re-arm speed bends past +100% increased (every point above counts half)". Before it re-arm speed
      // was not modelled; the 2.5 s base is the sim's own assumption.
      if (is0564(GD)) {
        const ri = pickMods(mods, 'TrapRearm', 'Inc').filter(m => applies(ctx, m)); let inc = 0; for (const m of ri) { inc += m.v; use(m); }
        const eff = inc <= 100 ? inc : 100 + (inc - 100) / 2;
        if (inc > 0) { rearm /= 1 + eff / 100; res.notes.push('Trap re-arm speed +' + Math.round(inc) + '% increased' + (inc > 100 ? ' (counts as +' + Math.round(eff) + '%, patch 0.56.4)' : '') + '.'); }
      }
      usesPerSec = traps / rearm; useTime = 1 / usesPerSec;
      res.notes.push('Trap: ' + traps + ' traps each striking every ' + rearm + ' s once laid; assumes the boss stands on them.');
      // Patch 0.56.0 notes: "With several traps of one skill out, each extra trap deals 10% less." The first trap
      // full, the others 10% less each: averaged over the traps out. Taken from Trap's text when it says so.
      const xt = /each extra trap deals (\d+)% less/i.exec(d);
      const extraLess = xt ? +xt[1] : is056(GD) ? 10 : 0;
      // 0.56.5 (Trap Support text): "each Trap past the first adds 90% of a Trap's damage, and each past your sixth
      // (all your Trap skills count) adds 40%". Counted for this skill's traps alone.
      const tx = /past the first adds (\d+)% of a Trap's damage, and each past your sixth[^.]*?adds (\d+)%/i.exec(d);
      if (is0565(GD) && traps > 1) {
        const a = tx ? +tx[1] / 100 : 0.9, b = tx ? +tx[2] / 100 : is0567(GD) ? 0.25 : 0.4;
        countFactor = countShare(traps, a, b);
        res.notes.push('Traps share their damage (patch 0.56.5): each past the first adds ' + Math.round(a * 100) + '% of one, past the sixth ' + Math.round(b * 100) + '% (x' + countFactor.toFixed(3) + ' on average over ' + traps + '; other Trap skills count toward the six in game, not here).');
      } else if (extraLess && traps > 1) {
        countFactor = (1 + (traps - 1) * (1 - extraLess / 100)) / traps;
        res.notes.push('Trap: each trap past the first deals ' + extraLess + '% less (x' + countFactor.toFixed(3) + ' on average over ' + traps + ' traps, patch 0.56).');
      }
    }
    // Deliveries that hit on their own clock (read from the skill text; cast speed only places them).
    let hitFactor = 1; const desc = sk.Description || '';
    if (sk.Delivery === 'Aura' || (sk.Ground && sk.Ground.Tick && !sk.Ground.Duration)) {
      // Toggled ground (Unholy Void): ticks every Ground.Tick s at Ground.TickScale of the shown hit.
      // Checked against the in-game tooltip: "Casts per second 2.00", 70% a tick.
      let tps, scale;
      if (sk.Ground && sk.Ground.Tick) { tps = 1 / sk.Ground.Tick; scale = sk.Ground.TickScale || 1; }
      else {
        const tw = /(once|twice|three times|four times|(\d+(?:\.\d+)?) times) a second/i.exec(desc);
        const words = { once: 1, twice: 2, 'three times': 3, 'four times': 4 };
        tps = tw ? (words[tw[1].toLowerCase()] || parseFloat(tw[2])) : 2;
        const pct = /(\d+)% of the damage shown/i.exec(desc); scale = pct ? +pct[1] / 100 : 1;
      }
      hitFactor = scale;
      // 0.56.5: "Auras and consecrated ground tick {v}% faster" (TickRate; Holy Rite node, The Pilgrim's Pyre).
      let tickInc = 0; for (const m of pickMods(mods, 'TickRate', 'Inc')) if (applies(ctx, m)) { tickInc += m.v; use(m); }
      if (tickInc) tps *= Math.max(0.1, 1 + tickInc / 100);
      usesPerSec = tps; useTime = 1 / tps;
      res.notes.push('Aura: ' + tps + ' ticks a second at ' + Math.round(hitFactor * 100) + '% of the shown damage; cast speed does not change it.');
    } else if (sk.Delivery === 'Brand') {
      // Sparks: "Every X seconds it strikes its host ... Lasts N seconds; up to K sparks at once". Throwing at the
      // cooldown keeps min(K, duration x throws a second) sparks on one boss, each striking every X s.
      // 0.56.5 text puts a bracket in: "Every 0.5 seconds (sooner with cast speed and Spark strike rate) it strikes".
      const ev = /Every ([\d.]+) seconds?(?: \([^)]*\))? it strikes/i.exec(desc);
      if (ev) {
        const lasts = /Lasts ([\d.]+) seconds/i.exec(desc) || (sk.BrandDuration ? [0, sk.BrandDuration] : null), capM = /up to (\d+) sparks/i.exec(desc) || (sk.BrandMax ? [0, sk.BrandMax] : null);
        // 0.56.2 (patch notes 7 Nov: "Sparks now gather into one strike per three"). Log 7 Nov "Spark87: ON, every 3 Sparks
        // gather into one body (strike x0.85 per spark), 4 spark skills live 4.0 s longer, cast speed quickens strikes
        // (exp 0.50)"; Storm Spark line: "3 sparks -> 1 bodies, each strikes x2.55 every 0.46 s (base 0.50, cast speed
        // x1.16), lives 9.0 s" (0.5 / sqrt(1.16) = 0.464; 0.49 s at x1.04), FieldDuration 9 s (data 5 +4), Venom 11 (7+4), Rime 9 (5+4).
        // Only a full set of 3 was seen in the log: a larger cap (Thunderhead, Cinderwick...) is assumed to merge per 3; "Echo +1 body" is not modelled.
        const gather = is0562(GD);
        // Build 26551640 (10 Nov 2026): the data's Brand duration (Ember 6, Storm 5, Venom 7, Rime 5) gets +7 s, not +4. Log
        // 9 Nov 21:13 "Spark87: ON ... 4 spark skills live 7.0 s longer", "FieldDuration: Spark ember_spark lasts 19.50 s (base 13.00
        // x1.50)" and storm_brand 18.00 s (base 12.00); Ember Spark panel 10 Nov: "Lasts 19.5 s (base 13.0 s)". The text now says
        // "Lasts {BrandLife} seconds", so the number comes from the data.
        const sparkLife = GD.steamBuild && +GD.steamBuild >= 26551640 ? 7 : 4;
        const baseDur = lasts ? +lasts[1] + (gather ? sparkLife : 0) : 0;
        let durInc = 0; for (const m of pickMods(mods, 'SkillDuration', 'Inc')) if (applies(ctx, m)) { durInc += m.v; use(m); }
        // 10 Nov 2026 23:50 log: Ember Spark lasts 17.68 s (base 13 x1.36).
        // The Thousand Sparks' 15% less duration multiplies the +60% increased:
        // 13 x1.60 x0.85 = 17.68, not 20.8. Same rule for Storm: 12 x1.36 = 16.32.
        let durMore = 1; for (const m of pickMods(mods, 'SkillDuration', 'More')) if (applies(ctx, m)) { durMore *= Math.max(0, 1 + m.v / 100); use(m); }
        const dur = baseDur * Math.max(0, 1 + durInc / 100) * durMore;
        // "+N to the maximum number of Sparks (at most 27 Sparks in all)". Storm Spark tooltip 4 Nov: base 3,
        // Thunderhead + Brand Smith + Crown of Sparks -> "Counted with 6 brands on the enemy".
        let extra = 0; for (const m of pickMods(mods, 'BrandCount', 'Flat')) if (applies(ctx, m)) { extra += m.v; use(m); }
        const cap = capM ? Math.min(27, +capM[1] + extra) : 0;
        // 0.56.5 log (owner's Shrimpage, 9 Nov 2026 12:48, build 26543267): "SparkCast91: storm_brand one cast threw 2 bodies ->
        // 6/6 Sparks (refresh ...), each body every 0.30 s = 6.57 strikes/s" with 23% increased cast speed and 35% Spark strike
        // rate (Brand Smith 15, Thunderhead 10, Sparking Sky 10): 0.5 / 1.23 / 1.35 = 0.301 s fits; the 0.56.2 square root
        // (0.5 / sqrt(1.23) / 1.35 = 0.334 s) does not. So from 0.56.5 cast speed counts in full and Spark strike rate on top.
        const spark565 = is0565(GD);
        // 9 Nov 2026 (14:25 log, same character and gear as the Storm tooltip): Storm 0.33 s, Venom 0.27 s, Rime 0.47 s
        // = base / sqrt(cast speed 1.23) / 1.35 (0.334, 0.267, 0.467); full cast speed would give 0.30, 0.24, 0.42. Ember Spark
        // tooltip: 0.50 s = 0.8 / sqrt(1.384) / 1.35 (0.504). So cast speed counts as its square root (the 0.30 s line above
        // was seen with a higher cast speed, not a different rule).
        // 10 Nov 2026 (Shrimpmage, cast speed x0.97 after Spell Echo and Controlled Destruction): Ember Spark tooltip "every 0.59 s"
        // = 0.8 / 1.35, and "Cooldown 1.0 s, 1.00 casts a second" while the cast time is 0.51 s: a cast speed under 1 does not
        // slow Sparks or their cooldown, only a faster one speeds them up (the sim said 0.60 s and 1.03 s).
        let strikeEvery = gather ? +ev[1] / Math.sqrt(Math.max(speedRate, 1)) : +ev[1];
        let sparkRate = 0; for (const m of pickMods(mods, 'SparkRate', 'Inc')) if (applies(ctx, m)) { sparkRate += m.v; use(m); }
        if (sparkRate) strikeEvery /= Math.max(0.1, 1 + sparkRate / 100);
        // Strikes a second for n sparks: each full group of 3 is one body striking x(3 x 0.85); leftovers strike alone.
        // 0.56.5: leftovers form a body too, at 0.85 a spark (same log: "SparkFill90: storm_brand body carries 2 Sparks
        // (strike x1.70)" next to a body of 3 at x2.55; "5 sparks -> 2 bodies, each strikes x2.12"). So n sparks strike
        // n x 0.85 per interval, in ceil(n / 3) bodies.
        // Each body strikes n x 0.85 per interval, nothing more. 10 Nov 2026 Ember Spark panel (level 74 Shrimpmage): 5,829,352 DPS
        // = 14.04 spark-hits a second (3 bodies / 0.545 s x 2.55) x avg hit 282,323 x crit 1.432 + ignite 152,019 (the panel shows
        // crit 30.0% x2.44, 5.5 strikes a second). The 9 Nov fit of x1.5 (level 58, panels 21.46 and 20.12 hit-equivalents against
        // 14.3 and 13.4) no longer holds on this build: with it the sim gave 8.56M (1.47x), without it 5.76M (0.988).
        const SPARK565_STRIKE = 1;
        const strikeRate = n => spark565 && gather ? n * 0.85 * SPARK565_STRIKE / strikeEvery : gather ? (Math.floor(n / 3) * 3 * 0.85 + (n % 3)) / strikeEvery : n / strikeEvery;
        const throwsPerSec = usesPerSec; // cast rate, already capped by the cooldown
        // 0.56.5 (Spark texts, build 26543267): "One cast throws all your Sparks at once ... recast to refresh them": the
        // full cap stands while you recast within a Spark's life (else the share of time they stand).
        const allAtOnce = is0565(GD);
        const sparksFor = rate => !(cap && dur) ? 1 : allAtOnce ? cap * Math.min(1, dur * rate) : Math.max(1, Math.min(cap, dur * rate));
        const sparks = sparksFor(throwsPerSec);
        usesPerSec = strikeRate(sparks); useTime = 1 / usesPerSec;
        res.brand = { sparks, every: strikeEvery, duration: dur, cap: cap || 1, rate: strikeRate, sparksFor, allAtOnce, castsPerSec: throwsPerSec };
        if (allAtOnce && cap > 1) res.notes.push('One cast throws all ' + cap + ' Sparks (patch 0.56.5).' + (sparkRate ? ' Sparks strike ' + Math.round(sparkRate) + '% faster.' : ''));
        res.notes.push('Spark: ' + (sparks % 1 ? sparks.toFixed(1) : sparks) + ' on the target' + (cap ? ' (up to ' + cap + ', each lasting ' + dur.toFixed(1) + ' s, thrown ' + throwsPerSec.toFixed(2) + ' times a second)' : '') + ', each striking every ' + (gather ? strikeEvery.toFixed(2) : ev[1]) + ' s' + (gather ? ', every 3 gathered into one body (x0.85 per spark)' : '') + '. Different Spark skills stack on the same enemy.');
      }
    } else if (sk.Orbit && sk.Orbit.AngularSpeed && sk.Delivery === 'Orbit') {
      // A toggled ring (Orbiting Hammers): every hammer passes a target once per turn, so it is hit
      // count x turns a second. Hammers: Count + one per CountPerLevels reached by the gem's own level
      // (gear levels do not add hammers). Fits the game's panel within 2% (25,351 at gem 18: 7 x 280/360).
      const ob = sk.Orbit;
      let count = (ob.Count || 0) + (ob.CountPerLevels || []).filter(l => own >= l).length;
      for (const m of pickMods(mods, 'OrbitCount', 'Flat')) if (applies(ctx, m)) { count += m.v; use(m); }
      // 0.56.5: "Orbiting blades and hammers turn {v}% faster" (OrbitRate; Zeal, Dawn, Orbit nodes).
      let orbInc = 0; for (const m of pickMods(mods, 'OrbitRate', 'Inc')) if (applies(ctx, m)) { orbInc += m.v; use(m); }
      const turns = ob.AngularSpeed / 360 * Math.max(0.1, 1 + orbInc / 100);
      usesPerSec = count * turns; useTime = 1 / usesPerSec;
      res.orbitRing = { count, turnsPerSec: turns };
      res.notes.push(sk.Name + ': ' + count + ' in the ring, turning ' + turns.toFixed(2) + ' times a second, so a target is struck ' + usesPerSec.toFixed(2) + ' times a second (cast speed does not change it).');
    } else if (sk.Totem && sk.Totem.Interval > 0 && shape !== 'totem_support' && (shape !== 'trap_support' || totemAttack)) {
      // A totem attack (Ballista): each totem fires every Totem.Interval s while it stands; attack speed only
      // places it faster (Ballista tooltip: 1 totem every 0.7 s = 129 DPS). Totems: Max + one per PerLevels
      // reached + TotemCount (Multiple Totems, tree). TotemSpeed counted as faster firing (not checked).
      const tt = sk.Totem;
      let count = (tt.Max || 1) + (tt.PerLevels || []).filter(l => own >= l).length;
      for (const m of pickMods(mods, 'TotemCount', 'Flat')) if (applies(ctx, m)) { count += m.v; use(m); }
      if (o.totemCount > 0) count = Math.floor(o.totemCount); // set by hand (owner request, 9 Nov 2026)
      // 0.56.2 (patch notes 7 Nov): at most 6 Ballistas and 10 Totems stand at once.
      if (is0562(GD)) count = Math.min(count, tt.Kind === 'Ballista' ? 6 : 10);
      let tsInc = 0; for (const m of pickMods(mods, 'TotemSpeed', 'Inc')) if (applies(ctx, m)) { tsInc += m.v; use(m); }
      const every = tt.Interval / Math.max(0.1, 1 + tsInc / 100);
      usesPerSec = count / every; useTime = 1 / usesPerSec;
      res.totem = { count, every };
      // Patch 0.56.0: Ancestral Host and Siege Pact cost "Each Totem or Ballista past the first deals 20% less damage"
      // (their text in the 0.56 data, Steam build 26495270), so only a hero holding one of them pays it, averaged
      // over the totems out. A plain Ballista keeps every totem at full damage.
      const totemLess = totemPastFirstLess(GD, ch, o.off);
      if (is0565(GD) && count > 1) {
        // 0.56.5: each past the first adds 80% of one, past the sixth 20% (Multiple Totems text). Ancestral Host and
        // Siege Pact still say "Each Totem or Ballista past the first deals 20% less" in build 26543267: counted on top.
        const k = 1 - totemLess / 100;
        countFactor = (1 + ((Math.min(count, 6) - 1) * 0.8 + Math.max(0, count - 6) * 0.2) * k) / count;
        res.notes.push('Totems share their damage (patch 0.56.5): each past the first adds 80% of one, past the sixth 20%' + (totemLess ? ', and your keystone makes each past the first deal ' + totemLess + '% less' : '') + ' (x' + countFactor.toFixed(3) + ' on average over ' + count + ').');
      } else if (totemLess && count > 1) {
        countFactor = (1 + (count - 1) * (1 - totemLess / 100)) / count;
        res.notes.push('Totems: your keystone makes each one past the first deal ' + totemLess + '% less (x' + countFactor.toFixed(3) + ' on average over ' + count + ').');
      }
      res.notes.push(sk.Name + ': ' + count + ' totem' + (count > 1 ? 's' : '') + ', each firing every ' + every.toFixed(2) + ' s (attack speed only places them faster); assumes every totem shoots this enemy.');
    } else if (sk.Delivery === 'Rain' && sk.Rain && sk.Rain.Waves > 0) {
      if (!(coc && coc.attack && coc.counted)) res.notes.push(sk.Name + ': every use rains ' + sk.Rain.Waves + ' waves on the area; an enemy that stays in it is struck by each.');
    } else if (sk.Delivery === 'CorpseBurst') {
      // Pyre Burst (new in 0.56): each cast burns a corpse or sacrifices a minion, plus a share of the slain's life
      // as extra fire. Neither is modelled yet (no log or tooltip from a fight to check them against).
      res.notes.push(sk.Name + ': every cast needs a corpse or one of your minions; this sheet assumes one is always there and leaves out the extra fire from the corpse\'s life.');
    } else if (['Orb', 'Orbit', 'Ground', 'Skyfall', 'Rain', 'Totem'].includes(sk.Delivery)) {
      res.notes.push(sk.Delivery + ' skills hit on their own pattern; this sheet counts one hit per cast. Set "hits per second" by hand if you know the real rate.');
    }
    if (host) {
      const hostSup = supportList.map(s => s.replace('@granted', '')).filter(s => lc(s) !== 'channel_conduit');
      const hr = calcSkill(GD, ch, host.skill, { _col: col, off: o.off, supportsOverride: hostSup, conduit: false, enemyLevel: o.enemyLevel, enemyRarity: o.enemyRarity, enemyHallowedGround: o.enemyHallowedGround, flashfire: o.flashfire });
      const interval = conduitInterval(GD, col.mods);
      if (hr.speed && hr.speed.usesPerSec > 0) {
        const tick = 1 / hr.speed.usesPerSec, ticks = Math.max(1, Math.ceil(interval / tick - 1e-9));
        usesPerSec = 1 / (tick * ticks); if (cooldown > 0) usesPerSec = Math.min(usesPerSec, 1 / cooldown); useTime = 1 / usesPerSec;
        res.conduit = { host: host.skill, hostName: host.name, linked: host.linked, tick, interval, ticks };
        res.notes.push('Cast by ' + host.name + '\'s Channel Conduit' + (host.linked ? '' : ' (no saved link: assumed)') + ' with ' + host.name + '\'s supports: one cast every ' + ticks + ' ' + host.name + ' tick' + (ticks > 1 ? 's' : '') + ' (tick ' + Math.round(tick * 1000) + ' ms, Conduit interval ' + Math.round(interval * 1000) + ' ms) = ' + usesPerSec.toFixed(2) + ' casts a second while you channel. Faster ' + host.name + ' (attack speed) means more casts until a tick is shorter than the interval.');
      }
    }
    // Cast on Crit: one cast per attack volley that crits, at most once per TrigCooldown (0.15 s; a totem's trigger
    // once per second). The game rolls crit once per volley, so all its arrows share one roll: P = crit chance.
    // Shrimpbow's log (1 Nov, 10 Guardian fights, boss present): Ember Bolt cast 0.62 times per Split Shot release
    // at 66.6% crit (sheet with this rule 0.62-0.67; with a roll per arrow it was ~1.0). Repeats, Rain waves and
    // second falls are separate volleys. Triggered casts add to Conduit casts; your own casting is not counted.
    if (coc && coc.source) {
      res.notes.push('Cast on Crit: this skill\'s crits cast ' + coc.name + ' (its link). Pick ' + coc.name + ' to see that damage; it is not part of this skill\'s DPS.');
    } else if (coc) {
      if (!coc.counted) {
        res.notes.push(coc.attack ? 'Cast on Crit with nothing linked: this attack strikes by itself when your other attacks crit, and there is no other attack on your bar' + (coc.skill ? ' (' + coc.name + ' does not count)' : '') + '. Pick one in the Cast on Crit box.'
          : coc.skill ? 'Cast on Crit: ' + coc.name + ' has no hit of its own to crit with, so no triggered casts are counted.'
          : 'Cast on Crit in this spell\'s own sockets is cast by your attacks\' crits, and there is no attack on your bar. If it is linked to another skill in game (build codes do not carry links), pick that skill in the Cast on Crit box.');
      } else {
        const hr = calcSkill(GD, ch, coc.skill, { _col: col, off: o.off, coc: false, conduit: false, enemyLevel: o.enemyLevel, enemyRarity: o.enemyRarity, enemyRes: o.enemyRes, curses: o.curses, enemyHallowedGround: o.enemyHallowedGround, flashfire: o.flashfire });
        if (hr.speed && hr.hits && hr.crit) {
          const cs = GD.supports.cast_on_crit || {};
          const cdLine = mods.find(m => m.stat === 'TrigCooldown') || (cs.Mods || []).map(m => ({ v: m.Stat === 'TrigCooldown' ? m.Value : 0 })).find(m => m.v > 0);
          const srcSk = GD.skills[lc(coc.skill)] || {};
          const totemSrc = !!(srcSk.Totem || hr.shape === 'totem_support');
          let tau = coc.attack ? COC_ATTACK_GAP : totemSrc ? Math.max(1, cdLine ? cdLine.v : 0.15) : (cdLine ? cdLine.v : 0.15);
          // 0.56.5: a spell casting itself (Cast on Crit in its own sockets) waits at least 0.3 s, and such spells take turns.
          const coc565 = is0565(GD) && !coc.attack && !totemSrc;
          const selfTurns = coc565 && coc.mode === 'self' ? (coc.selfSpells || 1) : 1;
          if (coc565 && coc.mode === 'self') tau = Math.max(tau, 0.3);
          const per = Math.max(1, hr.hits.projOnTarget || 1);
          const volleys = (hr.hits.hitsPerSec || 0) / per;
          const c = clamp(hr.crit.chance / 100, 0, 1);
          const p = c;
          const lam = volleys * p, T = volleys > 0 ? 1 / volleys : Infinity;
          let rate = lam / (1 + lam * Math.max(0, tau - T));
          rate = Math.min(rate, 1 / tau);
          // Attacks with nothing linked share one 0.75 s budget: split evenly between them.
          if (coc.attack && coc.shared > 1) rate /= coc.shared;
          // 0.56.5: self-casting spells take turns on the same crits (split evenly); all Cast on Crit users share one
          // 0.15 s clock (READ AS: each gets at most an even share of it; not checked in a log yet).
          if (selfTurns > 1) rate /= selfTurns;
          if (coc565 && (coc.users || 1) > 1) rate = Math.min(rate, 1 / (0.15 * coc.users));
          if (coc565 && (selfTurns > 1 || (coc.users || 1) > 1)) res.notes.push('Cast on Crit (patch 0.56.5): one critical hit casts one spell' + (selfTurns > 1 ? '; your ' + selfTurns + ' spells holding it take turns (at most one every 0.3 s)' : '') + ((coc.users || 1) > 1 ? '; your ' + coc.users + ' skills with Cast on Crit share one 0.15 s clock' : '') + '.');
          // The spell's own cooldown does not hold triggered casts back: Storm Spark (1.5 s cooldown) cast by
          // Cast on Crit came every 0.15-0.5 s in the 2 Nov log (450 sparks in 242 s of fighting, shortest gap
          // 0.147 s), so only the trigger's own 0.15 s gap limits them.
          usesPerSec = (res.conduit ? usesPerSec : 0) + rate; useTime = usesPerSec > 0 ? 1 / usesPerSec : Infinity;
          // A Spark's damage comes from its strikes, not its casts: triggered casts keep sparks on the target.
          if (res.brand) {
            const b = res.brand, sparks = b.sparksFor ? b.sparksFor(usesPerSec) : b.duration ? Math.max(1, Math.min(b.cap, b.duration * usesPerSec)) : 1;
            res.notes = res.notes.filter(x => !/^Spark: /.test(x));
            res.notes.push('Spark: ' + (sparks % 1 ? sparks.toFixed(1) : sparks) + ' on the target (up to ' + b.cap + ', each lasting ' + b.duration.toFixed(1) + ' s, cast ' + usesPerSec.toFixed(2) + ' times a second by Cast on Crit), each striking every ' + b.every.toFixed(2) + ' s.');
            b.sparks = sparks; usesPerSec = b.rate(sparks); useTime = 1 / usesPerSec;
          }
          res.coc = { source: coc.skill, sourceName: coc.name, mode: coc.mode, attack: !!coc.attack, shared: coc.shared || 1, crit: hr.crit.chance, perVolley: per, volleysPerSec: volleys, pVolley: p, rate, tau, cooldown };
          if (coc.attack) res.notes.push('Cast on Crit with nothing linked: this attack strikes by itself when ' + coc.name + (coc.mode === 'self' ? ' (the first other attack on your bar)' : ' (picked on the page)') + ' crits: ' + volleys.toFixed(2) + ' volleys a second at ' + hr.crit.chance.toFixed(1) + '% crit, at most one strike per ' + tau + ' s' + (coc.shared > 1 ? ' shared by your ' + coc.shared + ' attacks with it (split evenly)' : '') + ' = ' + rate.toFixed(2) + ' strikes a second, each 25% and a further 44% less (patch notes 5 Nov). Using it by hand is not counted.' + (sk.Delivery === 'Rain' ? ' A triggered Rain drops one wave.' : ''));
          else
          res.notes.push('Cast on Crit from ' + coc.name + (coc.mode === 'self' ? ' (the first attack on your bar)' : coc.mode === 'chosen' ? ' (picked on the page)' : ' (its link)') + ': ' + volleys.toFixed(2) + ' volleys a second at ' + hr.crit.chance.toFixed(1) + '% crit (one roll per volley, so ' + Math.round(p * 100) + '% of volleys crit); at most one cast per ' + tau + ' s' + (cooldown > 0 ? ' (the spell\'s ' + cooldown.toFixed(2) + ' s cooldown does not apply to triggered casts)' : '') + ' = ' + rate.toFixed(2) + ' casts a second' + (res.conduit ? ' on top of the Conduit casts' : '') + '. Each triggered cast deals 25% less. Rate matched the 1 Nov log (Ember Bolt from Split Shot).');
        }
      }
    }
    // Cast rate measured in fights (game log): replaces casts per second only; each cast keeps all its
    // hits (second falls, repeats, projectiles). "Hits per second" below replaces the whole hit rate.
    if (o.castsPerSecOverride > 0 && !(o.hitsPerSecOverride > 0)) { usesPerSec = o.castsPerSecOverride; useTime = 1 / usesPerSec; res.notes.push('Casts per second from your fights: ' + o.castsPerSecOverride + ' (each cast keeps all its hits).'); }
    if (o.hitsPerSecOverride > 0) { usesPerSec = o.hitsPerSecOverride; useTime = 1 / usesPerSec; res.notes.push('Hits per second set by hand: ' + o.hitsPerSecOverride + '.'); }
    if (animUses != null && usesPerSec === animUses) res.notes.push('Animation speed: this skill\'s clip plays ' + Math.round(Math.abs(animRate - 1) * 100) + '% ' + (animRate > 1 ? 'faster' : 'slower') + ' than the weapon\'s attack time or the cast time (the game\'s animation Rate ' + animRate + '; matches the attack timing in the game log).');
    res.speed = { inc: speedInc, more: speedMore, animRate: animOn ? animRate : 1, rateMult, usesPerSec, useTime, cooldown, stat: speedStat, hitFactor };

    // ----- hits per use -----
    let repeats = 0;
    // Auras, Vows, toggles and dashes are never echoed (game tooltip: "Spell Echo: no, Unholy Void is an aura").
    // Toggles too: Spell Echo's text (0.56.4 and 0.56.5 data) "Never repeats ... a toggle like Orbiting Hammers"; the
    // hammers' own text "press again to turn it off". Before 9 Nov 2026 the sim gave the ring its repeats.
    const noEcho = ['Aura', 'Vow', 'Woe', 'Toll', 'Sentence', 'Blink', 'Dash'].includes(sk.Delivery) || ctx.tags.has('aura') || /press again to turn it off/i.test(sk.Description || '');
    // A spell cast by Cast on Crit is not echoed: in the 1 Nov logs Ember Bolt (Cast on Crit + Spell Echo) fired one
    // release per trigger and never wrote an "Echo:" line, while every Repeat shot of Split Shot did (6,140). Spell
    // Echo's 15% less damage and cast speed still count. The skill panel pass (cast by hand) keeps the echo.
    const cocNoEcho = !!res.coc && !res.conduit;
    // 0.56.5 (Spell Echo / Repeat / Afterimage / Multistrike texts, build 26543267): "Repeats from a support gem and from
    // your gear or passive tree stack, but the repeats from the smaller of the two deal 50% less damage." Kept as a
    // damage share (repeatWeight) on the repeats; a tie halves the gear/tree ones.
    let repSup = 0, repGear = 0;
    if (!noEcho && !cocNoEcho) for (const m of pickMods(mods, 'Repeats', 'Flat')) if (applies(ctx, m)) { repeats += m.v; use(m); if (String(m.key || '').startsWith('support:')) repSup += m.v; else repGear += m.v; }
    const repeatWeight = is0565(GD) && repSup > 0 && repGear > 0 ? (1 + Math.max(repSup, repGear) + 0.5 * Math.min(repSup, repGear)) / (1 + repeats) : 1;
    if (repeatWeight < 1) res.notes.push('Repeats: ' + repSup + ' from supports and ' + repGear + ' from gear or passives stack; the ' + (repSup < repGear ? 'support' : 'gear/passive') + ' repeat' + (Math.min(repSup, repGear) > 1 ? 's deal' : ' deals') + ' 50% less (patch 0.56.5).');
    if (cocNoEcho && pickMods(mods, 'Repeats', 'Flat').some(m => applies(ctx, m))) res.notes.push('Spell Echo does not repeat a spell cast by Cast on Crit (the game log shows one cast per trigger, never an echo), so it only costs this spell 15% damage here. The skill panel still shows it, as the game\'s tooltip does.');
    let projectiles = 0;
    if (ctx.tags.has('projectile')) {
      projectiles = (sk.Projectiles || 1) + (sk.ProjectilesAtLevels || []).filter(l => L >= l).length;
      for (const m of pickMods(mods, 'Projectiles', 'Flat')) if (applies(ctx, m)) { projectiles += m.v; use(m); }
    }
    // Orbit: every projectile strikes; ones sent at an enemy already struck this cast deal 60% less
    // (attacks 90% less). The game's log matches this: 4 projectiles x 2 echoes x 60% = 10.9 poisons/s.
    const orbitOn = shape === 'orbit';
    let projOnTarget = 1, projWeight = 1;
    if (projectiles && shape === 'rain_support') {
      // Rain: every enemy inside is struck twice, three times with 4 or more projectiles.
      projOnTarget = o.projOnTarget || (projectiles >= 4 ? 3 : 2); projWeight = projOnTarget;
      res.notes.push('Rain: the target is struck ' + projOnTarget + ' times per use.');
    } else if (projectiles && shape === 'skyfall') {
      projOnTarget = 1; projWeight = 1;
      res.notes.push('Skyfall: each enemy is struck once per use; extra projectiles only add targets.');
    } else if (projectiles && sk.Totem && sk.Totem.Kind === 'Ballista' && !orbitOn) {
      // Extra Ballista bolts spread like a fan: one strikes a given enemy. Ballista tooltip 1 Nov (Multiple
      // Projectiles, "Projectiles 3"): 139 DPS = one 57-120 bolt x crit every 0.7 s, so only one bolt counts.
      projOnTarget = clamp(o.projOnTarget || 1, 1, projectiles); projWeight = projOnTarget;
      if (projectiles > 1) res.notes.push('Ballista: ' + projectiles + ' bolts a shot spread out; one strikes this enemy, as the game\'s tooltip counts it (the others hit other enemies).');
    } else if (projectiles) {
      // Orbit holds at most ORBIT_MAX_ARROWS arrows (attacks); extra projectiles fly as usual but do not circle.
      const orbitCount = orbitOn && isAttack ? Math.min(projectiles, ORBIT_MAX_ARROWS) : projectiles;
      if (orbitCount < projectiles) res.notes.push('Orbit holds at most ' + ORBIT_MAX_ARROWS + ' arrows: ' + orbitCount + ' of your ' + projectiles + ' circle and strike this enemy (game log "arrows=' + ORBIT_MAX_ARROWS + '", skill panel "' + ORBIT_MAX_ARROWS + ' spheres").');
      projOnTarget = clamp(o.projOnTarget || (orbitOn ? orbitCount : 1), 1, projectiles);
      // The "% less" comes from Orbit's text ("already struck deals 60% less damage (an arrow or thrown blade 90%
      // less"). Patch 0.56.0 notes: "a spell's sphere sent at an enemy the same cast already struck deals 75% less
      // damage (was 60%)", so with 0.56 data it is at least 75 even if the text lags behind.
      const orbTxt = /already struck deals (\d+)% less[^(]*\([^)]*?(\d+)% less/i.exec((GD.supports.orbit || {}).Description || '');
      let orbitLess = isAttack ? (orbTxt ? +orbTxt[2] : 90) : (orbTxt ? +orbTxt[1] : 60);
      if (!isAttack && is056(GD)) orbitLess = Math.max(orbitLess, 75);
      projWeight = orbitOn ? 1 + (projOnTarget - 1) * (1 - orbitLess / 100) : projOnTarget;
      if (orbitOn && projOnTarget > 1) res.notes.push('Orbit: all ' + projOnTarget + ' projectiles strike this enemy; each after the first deals ' + orbitLess + '% less (worth ' + projWeight.toFixed(2) + ' full hits per cast).');
    }
    // Skyfall second fall: one more strike on the target per cast at the repeat's share of the damage.
    let skyRep = 0;
    // Not on Sparks: Storm Spark tooltip 4 Nov with Twice Judged (50%) = hit x crit x 6 sparks x 2 strikes a
    // second + ignite (91,918 vs the game's 91,880), no second fall; the log has no second-fall line for them.
    if ((sk.Delivery === 'Skyfall' || shape === 'skyfall') && sk.Delivery !== 'Brand') {
      for (const m of pickMods(mods, 'SkyfallRepeat', 'Flat')) if (applies(ctx, m)) { skyRep += m.v; use(m); }
      skyRep = Math.min(SKYFALL_REPEAT_CAP, skyRep) / 100;
      if (skyRep > 0) res.notes.push('Skyfall falls again 0.4 s later for ' + Math.round(skyRep * 100) + '% of the damage' + (skyRep >= SKYFALL_REPEAT_CAP / 100 ? ' (the game caps this at ' + SKYFALL_REPEAT_CAP + '%)' : '') + ': the target is struck a second time each cast.');
    }
    const falls = skyRep > 0 ? 2 : 1;
    let perHitFactor = projWeight / projOnTarget * (1 + skyRep) / falls; // average share of a full hit per hit
    // A Rain struck by Cast on Crit with nothing linked drops one wave (patch notes 5 Nov).
    const rainWaves = sk.Delivery === 'Rain' && sk.Rain && sk.Rain.Waves > 0 ? (res.coc && res.coc.attack ? 1 : sk.Rain.Waves) : 0;
    const strikes = mirage ? mirage.Hops : rainWaves || (typeof sk.Strikes === 'object' && sk.Strikes ? (sk.Strikes.Count || 1) : (+sk.Strikes || 1));
    // Mirage: every hop cuts; the last cut deals FinalScale (x1.8), so a use is worth Hops - 1 + FinalScale hits.
    if (mirage) {
      const fin = mirage.FinalScale || 1;
      perHitFactor *= (mirage.Hops - 1 + fin) / mirage.Hops;
      res.notes.push(sk.Name + ' cuts ' + mirage.Hops + ' times per use; the last cut deals ' + Math.round(fin * 100) + '% (' + (mirage.Hops - 1 + fin).toFixed(1) + ' full hits per use).');
    }
    if (strikes > 1 && !rainWaves && !mirage) res.notes.push(sk.Name + ' strikes ' + strikes + ' times per use; every strike is counted at the full hit (a stronger finisher is not modelled).');
    let hitsPerUse = o.hitsPerSecOverride > 0 ? 1 : (1 + repeats) * projOnTarget * strikes * falls;
    // Spell Echo on a Spark does not repeat the cast: it adds one more body of 3 Sparks (Ember Spark tooltip 9 Nov: "Spell
    // Echo adds one more body of 3 Sparks, so you hold 9 in all", 9 Sparks = 3 bodies x 2/s = 6.0 strikes/s, 29,024 DPS).
    if (sk.Delivery === 'Brand' && res.brand && res.brand.rate && repeats > 0 && !(o.hitsPerSecOverride > 0)) {
      const sp = Math.min(27, res.brand.sparks + 3 * repeats);
      usesPerSec = res.brand.rate(sp); useTime = 1 / usesPerSec; hitsPerUse = projOnTarget * strikes * falls;
      res.brand.sparks = sp;
      res.notes.push('Spell Echo adds ' + repeats + ' more body of 3 Sparks: ' + sp + ' Sparks in all (the cast is not repeated).');
    }
    if (!(o.hitsPerSecOverride > 0)) perHitFactor *= repeatWeight;
    // Spell Echo on a Spell Totem: the totem's casts are echoed, each echo at 80% (developer's patch notes 4 Nov,
    // patch 0.53: "Spell Echo repeats a Spell Totem's casts (each echo at 80%)"; not yet seen in the log).
    if (shape === 'totem_support' && repeats > 0 && !(o.hitsPerSecOverride > 0)) {
      perHitFactor *= (1 + TOTEM_ECHO * repeats) / (1 + repeats);
      res.notes.push('Spell Echo on a Spell Totem: the totem\'s casts are echoed, each echo at ' + Math.round(TOTEM_ECHO * 100) + '% of the cast (patch notes 4 Nov; the echoes fire in a fight, log 9 Nov). The game\'s own skill panel does not count them, so its DPS reads about ' + (1 + TOTEM_ECHO * repeats).toFixed(1) + 'x lower than this sheet.');
    }
    // Afterimages (scaling.json Meta AfterimageCap / AfterimageDamagePct; Shade of the Blow, idols, Earthbreaker):
    // a melee attack gets that many afterimages, at most the cap; each repeats the blow after the plain repeats
    // for 40% of its damage. Channelling and Movement skills get none (Leap Slam is a Movement skill).
    let afterimages = 0;
    if (!(o.hitsPerSecOverride > 0) && isAttack && ctx.tags.has('melee')) {
      let n = 0; const ai = pickMods(mods, 'Afterimages', 'Flat').filter(m => applies(ctx, m)); for (const m of ai) n += m.v;
      const META = (GD.scaling && GD.scaling.Meta) || {};
      if (n > 0 && (ctx.tags.has('channelling') || ctx.tags.has('movement'))) res.notes.push('Afterimages: ' + sk.Name + ' is a ' + (ctx.tags.has('movement') ? 'Movement' : 'Channelling') + ' skill, so it gets none (the game\'s rule).');
      else if (n > 0) {
        for (const m of ai) use(m);
        const cap = META.AfterimageCap || 3; afterimages = Math.min(cap, n); const pct = (META.AfterimageDamagePct || 40) / 100;
        // 0.56.4 notes: "Afterimages past 3 add half damage each." READ AS: each one past the cap repeats the blow for half
        // an afterimage's share (20% of the blow). NOT CHECKED against the game.
        const extra = is0564(GD) ? Math.max(0, n - cap) : 0;
        const blow = hitsPerUse / (1 + repeats), full = perHitFactor * hitsPerUse;
        hitsPerUse += (afterimages + extra) * blow; perHitFactor = (full + (afterimages * pct + extra * pct / 2) * full / (1 + repeats)) / hitsPerUse;
        res.notes.push('Afterimages: ' + afterimages + (extra ? ' + ' + extra + ' past the cap at half damage (patch 0.56.4)' : n > afterimages ? ' (capped from ' + n + ')' : '') + ', each repeats the blow for ' + Math.round(pct * 100) + '% of its damage.');
      }
    }
    // Traps or totems past the first dealing less (patch 0.56, set with the rate above).
    perHitFactor *= countFactor;
    const hitsPerSec = usesPerSec * hitsPerUse;
    res.hits = { repeats, projectiles, projOnTarget, projWeight, perHitFactor, orbit: orbitOn, strikes, skyfallRepeat: skyRep, afterimages, hitsPerUse, hitsPerSec, fullHitsPerSec: hitsPerSec * perHitFactor };

    // ----- the hit -----
    const hit = {}; let hitAvg = 0;
    for (const d of Object.keys(scaled)) { const a = scaled[d][0] * hitFactor, b = scaled[d][1] * hitFactor; hit[d] = { min: a, max: b, avg: (a + b) / 2 }; hitAvg += hit[d].avg; }
    res.hit = hit;
    res.hitAvg = hitAvg; res.hitAvgCrit = hitAvg * critFactor;
    res.sheetHitDps = hitAvg * critFactor * hitsPerSec * perHitFactor;

    // ----- enemy -----
    const lvl = o.enemyLevel || ch.level;
    const rarity = o.enemyRarity || 'rare';
    const isBoss = rarity === 'boss';
    const resist = {};
    for (const d of DT) resist[d] = o.enemyRes && o.enemyRes[d] != null ? o.enemyRes[d] : (d === 'Physical' ? 0 : Math.min(M.ResistMax, lvl * M.ResistPerLevel));
    // Guardian colour variant: extra resistance to its own element (bosses.json Variants, mostly 30-40%),
    // plus the Ward tier from Rupture 60 / 80 (+25% / +35%). They add up (closest to the 1 Nov fights);
    // ASSUMPTION: capped at the game's hard resistance cap (85%), as the files give monsters no cap.
    let guardian = null;
    if (isBoss && o.guardianElement && DT.includes(o.guardianElement) && !(o.enemyRes && o.enemyRes[o.guardianElement] != null)) {
      const E = o.guardianElement;
      const variant = o.guardianVariantResist != null ? +o.guardianVariantResist : 40;
      const ward = o.guardianWard != null ? +o.guardianWard : wardAt(GD, lvl);
      const cap = (GD.scaling.Hero || {}).ResistHardCap || 85;
      resist[E] = Math.min(cap, resist[E] + variant + ward);
      guardian = { element: E, variant, ward, resist: resist[E] };
      res.notes.push('Guardian element ' + E + ': its colour variant resists ' + E + ' ' + variant + '% more' + (ward ? ' and its Ward ' + ward + '% more' : '') + ' (' + resist[E] + '% in all, before penetration).');
    }
    const pen = {}; DT.forEach(d => pen[d] = 0);
    for (const m of pickMods(mods, 'Penetration', 'Flat')) {
      const { types, conds } = splitTags(m.tags);
      if (!condsOk(ctx, conds)) continue;
      let hit1 = false; for (const d of (types.length ? types : DT)) { pen[d] += m.v; if (ctx.dealt.has(d)) hit1 = true; }
      if (hit1) use(m);
    }
    const armour = o.enemyArmour != null ? o.enemyArmour : lvl * M.ArmourPerLevel;
    // Curses: more damage taken (all types) and per-element taken. A Guardian/boss only takes the strongest.
    // Int does not scale a curse's damage taken (game note: "Int never scales it"); the in-game tip
    // shows Woe of Withering on a poison skill as +30% = its 10% taken + 20% Poison taken, added.
    let curseEffInc = 0;
    for (const m of pickMods(mods, 'CurseEffect', 'Inc')) { curseEffInc += m.v; use(m); }
    const curseRows = [];
    for (const [id, cfg] of Object.entries(o.curses || {})) {
      const c = GD.curses[id]; if (!c || !cfg || !cfg.on) continue;
      // On a Rare / Unique / Guardian a Woe holds and grows Dread by itself up to Tough.Cap.
      const tough = (rarity === 'rare' || isBoss) && c.Tough && c.Tough.Holds ? (c.Tough.Cap || 0) : 0;
      const dread = Math.max(+cfg.dread || 0, tough);
      const dreadPct = c.Dread && dread ? Math.min(dread, isBoss ? (c.Dread.BossCap || c.Dread.Cap) : c.Dread.Cap) * c.Dread.EffectPct : 0;
      // Deepened Woe (CurseMore) in the Woe gem's own sockets: "Every line of the linked Woe is 25% stronger: the damage it
      // makes enemies take, the resistance it lowers, the damage they deal less and its slow" (in-game support tooltip,
      // owner's screenshot 9 Nov 2026, on Woe of the Tempest). Counted as its own multiplier on top of Dread and the
      // Guardian halving; ASSUMPTION: no tooltip yet shows whether it adds to those instead.
      const woeSups = c.Skill && lc(c.Skill) === lc(skillId) && o.supportsOverride ? o.supportsOverride : ((ch.sockets || []).find(s => c.Skill && lc(s.skill) === lc(c.Skill)) || {}).supports || [];
      let curseMore = 0;
      for (const sid of woeSups) for (const m of ((GD.supports[lc(sid)] || {}).Mods || [])) if (m.Stat === 'CurseMore' && m.Mode === 'Flat') curseMore += m.Value;
      const eff = (1 + curseEffInc / 100) * (1 + dreadPct / 100) * (1 + curseMore / 100) * (isBoss ? (c.BossEffect != null ? c.BossEffect : 1) : 1);
      const row = { id, name: c.Name, taken: (c.TakenPct || 0) * eff, elem: {}, eff, dread: dreadPct ? dreadPct / c.Dread.EffectPct : 0, more: curseMore };
      for (const [d, v] of Object.entries(c.ElementTakenPct || {})) row.elem[d] = v * eff;
      // Woes of Cinders / Rime / the Tempest lower a resistance instead (curses.json ResistDown), grown by
      // Dread and halved on a Guardian like the rest of the Woe.
      row.resDown = {}; for (const [d, v] of Object.entries(c.ResistDown || {})) row.resDown[d] = v * eff;
      curseRows.push(row);
    }
    const takenFor = (rows, d) => rows.reduce((p, r) => p * (1 + (r.taken + (r.elem[d] || 0)) / 100), 1);
    // Limits per enemy, by kind (curses.json: Woe and Sentence are separate kinds): one Sentence and up
    // to two Woes (Woe skill text "Two Woes per enemy"; log "Woe Bearer laid ... (1 Woes now, limit 2)").
    // Guardians take them all (BossEffect already halves a Woe). The best ones for this hit are kept.
    // CurseLimit lines ("You can lay +1 more Woe on each enemy": amulet Woe-sworn, Twofold Woe, Twin Oath) add Woes.
    let woeExtra = 0; for (const m of pickMods(mods, 'CurseLimit', 'Flat')) { woeExtra += m.v; use(m); }
    const LIMIT = { Sentence: 1, Woe: 2 + woeExtra };
    const hitTotal = Object.values(hit).reduce((a, h) => a + h.avg, 0) || 1;
    const worth = r => Object.keys(hit).reduce((a, d) => a + hit[d].avg / hitTotal * (r.taken + (r.elem[d] || 0) + (r.resDown[d] || 0)), 0);
    const kindOf = r => (GD.curses[r.id] || {}).Kind || '';
    let activeCurses = [];
    for (const kind of new Set(curseRows.map(kindOf))) {
      const rows = curseRows.filter(r => kindOf(r) === kind).sort((a, b) => worth(b) - worth(a));
      activeCurses.push(...(LIMIT[kind] ? rows.slice(0, LIMIT[kind]) : rows));
    }
    // Hunter's Marks (MarkOnHit): +X% damage taken per Mark up to a cap, doubled on a Guardian or Unique.
    // A separate group from Woes/Sentences, so a Guardian takes both its best curse and its Marks.
    let marks = 0, markPct = 0;
    for (const m of pickMods(mods, 'MarkOnHit', 'Flat')) if (applies(ctx, m)) { marks += m.v; use(m); }
    if (marks > 0) {
      const t = /([\d.]+)% more damage for each Mark, up to (\d+)/i.exec((GD.supports.hunters_mark_support || {}).Description || '');
      const per = t ? +t[1] : 1.4; let cap = t ? +t[2] : 10;
      for (const m of pickMods(mods, 'MarkMax', 'Flat')) { cap += m.v; use(m); }
      if (isBoss) cap *= 2;
      let eff = 0; for (const m of pickMods(mods, 'MarkEffect', 'Inc')) { eff += m.v; use(m); }
      // Marks fall off 3 s after the LAST hit, so any skill hitting more often than that keeps
      // stacking them to the cap.
      const held = hitsPerSec * marks >= 1 / 3 ? cap : 0;
      markPct = held * per * (1 + eff / 100);
    }
    res.marks = markPct ? { pct: markPct } : null;
    // Venom golem (Grave Golem with a poison support): "the venom golem makes enemies take 7.5% more damage" (skill
    // tooltip 9 Nov 2026; blessings radius 900 = 9 m). Counted as always in range, like the flame golem's blessing.
    const golemB = golemBlessing(GD, ch, sk, o);
    const golemTaken = golemB && golemB.stat === 'EnemyTaken' ? 1 + golemB.v / 100 : 1;
    if (golemTaken !== 1) res.notes.push('Your ' + golemB.name + ' makes enemies near it take ' + golemB.v + '% more damage (counted as if it is always within 9 m of the enemy).');
    const extraTaken = (1 + (o.extraTakenPct || 0) / 100) * (1 + markPct / 100) * golemTaken;
    // Maim (support): the skill's hits make the enemy take X% more Physical damage from you. The game's skill
    // panel counts it on the physical part of the hit, not on the bleed (Split Shot tooltip 1 Nov: 1,140 DPS =
    // hits x1.10 + 216 bleeding). Counted on hits only here too.
    let maimPct = 0;
    for (const m of pickMods(mods, 'MaimOnHit', 'Flat')) if (applies(ctx, m)) { maimPct += m.v; use(m); }
    if (maimPct) res.notes.push('Maim: the enemy takes ' + maimPct + '% more Physical damage from your hits (the game\'s skill panel counts it too).');
    const enemy = { level: lvl, rarity, resist, pen, armour, guardian, curses: curseRows, activeCurses: activeCurses.map(r => r.id), curseEffInc };
    res.enemy = enemy;
    const mitig = {};
    for (const d of DT) {
      // Unknown whether penetration can take resistance below 0; o.penFloor = it cannot.
      // A Woe's resistance cut lowers the resistance itself (it can go below 0); penetration comes after.
      const down = activeCurses.reduce((a, r) => a + (r.resDown[d] || 0), 0), base = resist[d] - down;
      const effRes = o.penFloor ? Math.min(base, Math.max(0, base - pen[d])) : base - pen[d];
      let k = 1 - Math.min(H.ResistHardCap || 90, effRes) / 100;
      if (d === 'Physical') {
        const ph = hit.Physical ? hit.Physical.avg * critFactor : 0;
        const dr = ph > 0 ? Math.min(H.ArmourMaxReduction, 100 * armour / (armour + H.ArmourFactor * ph)) : 0;
        k = (1 - dr / 100) * (1 - effRes / 100);
        mitig.armourReduction = dr;
      }
      mitig[d] = { effRes, k, taken: takenFor(activeCurses, d) * extraTaken * (d === 'Physical' ? 1 + maimPct / 100 : 1) };
    }
    res.mitig = mitig;
    let hitDpsVs = 0; const byType = {};
    for (const d of Object.keys(hit)) {
      const v = hit[d].avg * critFactor * hitsPerSec * perHitFactor * mitig[d].k * mitig[d].taken;
      byType[d] = v; hitDpsVs += v;
    }
    res.hitDpsByType = byType;
    res.hitDps = hitDpsVs;

    // ----- ailments -----
    // Duration: 2 s x (1 + passives + 1% per 10 Int), as the game's skill tooltip shows (3.34 s at L74).
    // NOTE: the game's combat log says "for 2.5s" for the same poisons, so real fights may get less.
    let ailDur = per10('Int', 'IntAilmentDurPer10');
    for (const m of pickMods(mods, 'AilmentDuration', 'Inc')) { ailDur += m.v; use(m); }
    const snap = s => (o.combatDuration ? Math.max(0.5, Math.floor(s / 0.5) * 0.5) : s);
    // Ticks are not reduced by resistance (the log: "tick 23520 = 47039.7/s x 0.5, poison taken x1.00");
    // they are raised by damage taken.
    let shockF = 1; // set below once the ailment modifiers are read; shocks raise all damage taken
    const dotTakenFor = d => (o.dotElementTaken ? mitig[d].taken : takenFor(activeCurses.map(r => ({ taken: r.taken, elem: {} })), undefined) * extraTaken) * shockF;
    let dotMulti = 0;
    for (const m of pickMods(mods, 'DotMulti', 'Flat')) { dotMulti += m.v; use(m); }
    const sumMod = (stat, mode) => { let s = mode === 'More' ? 1 : 0; for (const m of pickMods(mods, stat, mode)) if (applies(ctx, m)) { s = mode === 'More' ? s * (1 + m.v / 100) : s + m.v; use(m); } return s; };
    const ail = { dotMulti, durationInc: ailDur };
    res.ailments = ail;
    // ----- shock -----
    // scaling.json Ailments: a hit carrying Lightning shocks at ShockChance% (+ ShockChance lines) for ShockSeconds;
    // the enemy then takes ShockCoef x (lightning hit / its life)^ShockPow % more damage, ShockMin..ShockMax, and
    // ShockEffect raises the cap to ShockMaxCap. Living Storm (ShockStacks) lets more shocks sit at once, at most
    // 60% in all (its text). ASSUMPTIONS: shock effect scales the whole value, floor included; the enemy's life
    // is the game's curve (Base x exp(K x level^P)) x a typical level-1 life (monsters.json 1 Nov: Guardians 820,
    // the median monster 30) x its rarity's life (a Rupture 80 Guardian: 2.06M here, 1.85M in the 1 Nov log).
    if (A.bEnabled && hit.Lightning && A.ShockCoef) {
      const chance = clamp(A.ShockChance + sumMod('ShockChance', 'Flat'), 0, 100);
      if (chance > 0) {
        const ML = M.Life || { Base: 20, K: 0.225, P: 0.7 };
        const rar = (M.Rarity || {})[{ normal: 0, magic: 1, rare: 2 }[rarity]] || {};
        const life = o.enemyLife || (isBoss ? 820 : 30) * ML.Base * Math.exp(ML.K * Math.pow(lvl, ML.P)) * (isBoss ? 1 : rar.Life || 1);
        const lightHit = hit.Lightning.avg * critFactor * mitig.Lightning.k * mitig.Lightning.taken;
        const effK = Math.max(0, 1 + sumMod('ShockEffect', 'Inc') / 100) * sumMod('ShockEffect', 'More');
        const raw = A.ShockCoef * Math.pow(Math.max(0, lightHit) / life, A.ShockPow);
        const cap = effK > 1 ? Math.min(A.ShockMaxCap || A.ShockMax, A.ShockMax * effK) : A.ShockMax;
        const size = Math.min(cap, clamp(raw, A.ShockMin, A.ShockMax) * effK);
        const stacks = Math.max(1, Math.round(1 + sumMod('ShockStacks', 'Flat')));
        const ls = /at most (d+)% more damage taken/i.exec((GD.supports.living_storm || {}).Description || '');
        // 0.56.4: "stacked Shocks reach 75% (was 60%)"; the data's ShockStackCap and Living Storm's text say 75.
        const allCap = stacks > 1 ? (ls ? +ls[1] : is0564(GD) ? (A.ShockStackCap || 75) : 60) : cap;
        const dur = snap(A.ShockSeconds * (1 + ailDur / 100));
        // Orbit spheres and aura ticks count as part-hits, as for poison stacks.
        const rate = hitsPerSec * perHitFactor * hitFactor * chance / 100;
        // Shocks on the enemy at once: E[min(N, stacks)] with N ~ Poisson(rate x duration).
        const mu = rate * dur; let avg = 0, p = Math.exp(-mu), cum = 0;
        for (let k = 0; k < stacks; k++) { cum += p; avg += 1 - cum; p *= mu / (k + 1); }
        const pct = Math.min(allCap, size * avg);
        shockF = 1 + pct / 100;
        ail.shock = { chance, life, lightHit, raw, size, cap, stacks, allCap, duration: dur, rate, avg, pct, effInc: (effK - 1) * 100 };
        for (const d of Object.keys(byType)) byType[d] *= shockF;
        hitDpsVs *= shockF; res.hitDps = hitDpsVs;
        res.notes.push('Shock: ' + Math.round(chance) + '% chance a hit, each shock ' + size.toFixed(1) + '% more damage taken (' + (raw < A.ShockMin ? "the game's " + A.ShockMin + '% floor: your lightning hit is small next to its ~' + Math.round(life).toLocaleString('en-US') + ' life' : 'from your lightning hit vs its ~' + Math.round(life).toLocaleString('en-US') + ' life') + (effK !== 1 ? ', shock effect x' + effK.toFixed(2) : '') + '), ' + avg.toFixed(2) + ' of ' + stacks + ' on it on average = +' + pct.toFixed(1) + '%. Not checked against the game yet.');
      }
    }
    let poisonDps = 0, igniteDps = 0, bleedDps = 0;
    if (A.bEnabled) {
      const poisonChanceStat = sumMod('PoisonChance', 'Flat');
      const hasPoison = !!hit.Poison;
      let pChance = clamp((hasPoison ? A.PoisonChance : 0) + poisonChanceStat, 0, 100);
      // A PoisonChance stat also poisons with Physical (scaling.json Ailments doc).
      // The poisoning hit is the whole hit (the tooltip's 24,573/s a stack = 20% x the full average hit
      // x poison modifiers). Orbit's weaker spheres count as part-stacks, as the game's panel does.
      // Like Orbit's spheres, an aura's 70% ticks poison from the full shown hit and count as 0.7 of a
      // stack each (Unholy Void tooltip: 83,928/s a stack, "about 2.3 stacks" at 2 ticks x 50%).
      const eligible = ((hit.Poison ? hit.Poison.avg : 0) + (poisonChanceStat > 0 && hit.Physical ? hit.Physical.avg : 0)) * critFactor / hitFactor;
      if (!hasPoison && !(poisonChanceStat > 0 && hit.Physical)) pChance = 0;
      if (pChance > 0 && eligible > 0) {
        const pInc = sumMod('PoisonDamage', 'Inc'), pMore = sumMod('PoisonDamage', 'More');
        // Tooltip duration (what the skill panel uses) and combat duration: Virulence (Dragonling
        // Ascendancy) makes poisons last 25% shorter in combat (the log's 2.5 s = 3.34 s x 0.75), which
        // the tooltip leaves out, and lets Rares, Uniques and Guardians hold 60 stacks instead of 40.
        const tipDur = snap(A.PoisonSeconds * (1 + ailDur / 100));
        const dur = virulence ? tipDur * virulence.DurMult : tipDur;
        const cap = virulence && (rarity === 'rare' || rarity === 'boss') ? virulence.Cap : A.PoisonMaxStacks;
        const perStack = eligible * A.PoisonFracPerSec * Math.max(0, 1 + pInc / 100) * pMore * Math.max(0, 1 + dotMulti / 100);
        const rate = hitsPerSec * perHitFactor * hitFactor * pChance / 100;
        const stacksRaw = rate * dur;
        const stacks = Math.min(stacksRaw, cap);
        const m = A.bPoisonTakesDamageTaken ? dotTakenFor('Poison') : 1;
        poisonDps = stacks * perStack * m;
        const panelStacks = Math.min(rate * tipDur, A.PoisonMaxStacks);
        ail.poison = { chance: pChance, eligible, duration: dur, tipDuration: tipDur, virulence: !!virulence, perStack, stacks, stacksRaw, cap, panelStacks, inc: pInc, more: pMore, dps: poisonDps, perHitTotal: perStack * dur };
        if (virulence) res.notes.push('Virulence (Dragonling): poisons last ' + dur.toFixed(2) + ' s in combat instead of the tooltip\'s ' + tipDur.toFixed(2) + ' s; Rares and Guardians hold up to ' + virulence.Cap + ' stacks. The skill panel DPS uses the tooltip duration, like the game.');
      }
      const igChance = clamp((hit.Fire ? A.IgniteChance : 0) + sumMod('IgniteChance', 'Flat'), 0, 100);
      if (hit.Fire && igChance > 0) {
        const iInc = sumMod('IgniteDamage', 'Inc'), iMore = sumMod('IgniteDamage', 'More');
        const dur = snap(A.IgniteSeconds * (1 + ailDur / 100));
        const dps1 = hit.Fire.avg * critFactor * A.IgniteFrac / A.IgniteSeconds * Math.max(0, 1 + iInc / 100) * iMore * Math.max(0, 1 + dotMulti / 100);
        const mu = hitsPerSec * igChance / 100 * dur;
        const uptime = 1 - Math.exp(-mu);
        // IgniteStacks (Oath of Many Fires +3, Kindled Flesh and Searing Edge +1): "Your Ignites stack: +N Ignite burning on
        // an enemy at once" (node text and statText, build 26551640). Burning at once = E[min(N, ignites applied within the
        // duration)] with a Poisson count, as for shock stacks; each burns for the full dps1. NOT CHECKED against the game.
        let stacks = 1;
        for (const m of pickMods(mods, 'IgniteStacks', 'Flat')) { stacks += m.v; use(m, 'ignite stacks'); }
        stacks = Math.max(1, Math.round(stacks));
        let burning = uptime;
        if (stacks > 1) { burning = 0; let p = Math.exp(-mu), cum = 0; for (let k = 0; k < stacks; k++) { cum += p; burning += 1 - cum; p *= mu / (k + 1); } }
        igniteDps = dps1 * burning * dotTakenFor('Fire');
        ail.ignite = { chance: igChance, dps1, uptime, duration: dur, dps: igniteDps, stacks, burning };
        if (stacks > 1) res.notes.push('Ignites stack: up to ' + stacks + ' burn at once, ' + burning.toFixed(2) + ' on average (from how often you ignite in ' + (+dur.toFixed(2)) + ' s). Not checked against the game yet.');
        // Backdraft (ascended Pyromancer): "your Fire hits on Ignited enemies are always critical strikes, at 80% of
        // your critical bonus". Log 9 Nov 2026 17:09-17:11: 11 lines "AscB72: Backdraft-crit <skill> on <monster>: ...
        // FORCED CRIT, crit chance 100" on a build whose normal crit chance is 7-11% (the Flashfire lines). The log
        // does not show the 80% figure; it comes from the node text and rules.Backdraft.MultiKeep (0.8), so that part is
        // unverified. Ignited share of Fire hits = the ignite uptime above. Only the Fire part of the hit is forced;
        // ignite damage itself keeps the normal crit factor (not checked).
        if (ascFlag('Asc71_Backdraft') && byType.Fire !== undefined && critFactor > 0) {
          const keep = ((GD.dragon.rules || {}).Backdraft || {}).MultiKeep || 0.8;
          const forcedMulti = 100 + (effectiveMulti - 100) * keep;
          const blended = uptime * (forcedMulti / 100) + (1 - uptime) * critFactor;
          const delta = byType.Fire * (blended / critFactor - 1);
          byType.Fire += delta; hitDpsVs += delta; res.hitDps = hitDpsVs;
          res.backdraft = { uptime, forcedMulti, blendedFactor: blended, normalFactor: critFactor };
          res.notes.push('Backdraft: Fire hits on Ignited enemies always crit at ' + Math.round(forcedMulti) + '% damage (80% of the crit bonus). Counted for the ' + Math.round(uptime * 100) + '% of the time the enemy is Ignited; Fire hit damage x' + (blended / critFactor).toFixed(2) + '.');
        }
      }
      // Bleeding (Rend): "50% of the hit's physical damage each second for 4 seconds (the strongest bleed
      // holds; 50% more while the enemy moves)" = Ailments.BleedFracPerSec x the physical hit, one bleed at a
      // time like ignite. The duration comes from the source's text (Rend: 4 s). Counted as a standing
      // target: the 50% more while it moves is left out.
      const bleedChance = clamp(sumMod('BleedChance', 'Flat'), 0, 100);
      if (bleedChance > 0 && hit.Physical) {
        const bInc = sumMod('BleedDamage', 'Inc'), bMore = sumMod('BleedDamage', 'More');
        let baseDur = 4;
        for (const s of res.supports) { const d = s.ok && GD.supports[lc(s.id)] && /Bleeding[^.]*?for (\d+(?:\.\d+)?) seconds/i.exec(GD.supports[lc(s.id)].Description || ''); if (d) { baseDur = +d[1]; break; } }
        const dur = snap(baseDur * (1 + ailDur / 100));
        const dps1 = hit.Physical.avg * critFactor * (A.BleedFracPerSec || 0.5) * Math.max(0, 1 + bInc / 100) * bMore * Math.max(0, 1 + dotMulti / 100);
        const uptime = 1 - Math.exp(-hitsPerSec * perHitFactor * hitFactor * bleedChance / 100 * dur);
        bleedDps = dps1 * uptime * dotTakenFor('Physical');
        ail.bleed = { chance: bleedChance, dps1, uptime, duration: dur, dps: bleedDps, more: bMore, inc: bInc };
        res.notes.push('Bleeding: ' + Math.round(bleedChance) + '% chance, ' + Math.round(dps1) + '/s for ' + dur + ' s (strongest one holds, up ' + Math.round(uptime * 100) + '% of the time). Counted on a standing enemy: bleeds deal 50% more while it moves. Not checked against the game yet.');
      }
    }
    // ----- passive tree triggers (bursts, pillars, sky swords) -----
    // Oath of the Pyre (keystone): "Every fourth hit against a Burning enemy bursts: 40% of the hit as Fire damage to
    // enemies within 2.5 metres." Log 9 Nov 2026 17:20: ~25-28 "Trigger: Hit -> Nova (ember_spark, fired N) el Fire
    // pct 40 nth 4" lines per 10 s on the Training Post, so every Nth hit fires and the line's Pct and Element hold.
    // The other tree triggers follow the same rule from their node text (game data, build 26551640); NOT CHECKED in a
    // log yet:
    //   Hit:      every Nth hit of a matching skill adds Pct% of that hit (the whole hit, as Element).
    //   Crit:     every crit adds Pct% of the crit hit.
    //   SkillUse: every Nth use adds Count x Pct% of one hit (Hammer of Judgement: 3 Sky Swords x 55%; no Element =
    //             the hit's own damage types).
    // Value2 (the trigger's cooldown) and PerTarget (once per enemy every N s) cap how often it fires on one enemy.
    // One target only: the splash to other enemies is not counted, and all of a trigger's Count hit the one enemy.
    // Bursts copy the hit's crits (the average hit) and do not apply ailments of their own here. Tree lines only:
    // support triggers (Dawnbringer, Venom Bloom) log other numbers than their data (9 Nov: Judgement "pct 100 nth 1").
    {
      const trig = [];
      for (const m of mods) {
        // Tree lines, and gear lines (Overclock Coil: log 10 Nov 2026 13:43-13:49, equipped on Ember Spark / Flame Dash:
        // "Trigger: Hit -> Nova (ember_spark, fired N) el Lightning pct 40 nth 4" beside the tree's Fire one on the same
        // hits; Rupture 150 Zul Descendant kill: both novas together 10.1% of the damage, 32 Lightning + 40 Fire in 24 s).
        if (m.stat !== 'Trigger' || !(m.key === 'passives' || String(m.key || '').startsWith('item:'))) continue;
        const t = trigParse(m);
        if (!['Hit', 'Crit', 'SkillUse'].includes(t.when) || !t.pct) continue;
        if (!condsOk(ctx, t.conds)) continue;
        // "Cold hit", "Poison Spell hit": the skill's own tag (converted or extra damage does not make a Poison Spell)
        if (!t.types.every(d => ctx.tags.has(lc(d)))) continue;
        let share = 1; // VsBurning: only while the enemy burns
        if (t.state.includes('VsBurning')) share = ail.ignite ? ail.ignite.uptime : 0;
        if (t.state.includes('VsBurningOrShocked')) { const ig = ail.ignite ? ail.ignite.uptime : 0, sh = ail.shock ? 1 - Math.exp(-ail.shock.rate * ail.shock.duration) : 0; share = 1 - (1 - ig) * (1 - sh); }
        if (!share) continue;
        trig.push({ m, t, share });
      }
      // The hit as the sheet has it so far (Backdraft's forced crits included, as the Pyre burst counted them before),
      // with the enemy's mitigation taken back out: raw damage a second, per type.
      const rawBy = {};
      for (const d of Object.keys(byType)) { const q = mitig[d] ? mitig[d].k * mitig[d].taken * shockF : 0; rawBy[d] = q > 0 ? byType[d] / q : 0; }
      const rawPerSec = Object.values(rawBy).reduce((a, v) => a + v, 0);
      const hitDpsNow = Object.values(byType).reduce((a, v) => a + v, 0);
      const avgHit = hitsPerSec > 0 ? rawPerSec / hitsPerSec : 0; // an average hit (part-hits counted as parts)
      for (const { m, t, share } of trig) {
        // events: how often it fires on the enemy; size: the burst's raw damage each time (before the enemy's mitigation)
        let events, size;
        if (t.when === 'Hit') { events = hitsPerSec * share / t.nth; size = avgHit * t.pct / 100 * t.count; }
        else if (t.when === 'Crit') { events = hitsPerSec * share * critChance / 100 / t.nth; size = avgHit / (critFactor || 1) * effectiveMulti / 100 * t.pct / 100 * t.count; }
        else { events = usesPerSec * share / t.nth; size = avgHit * t.pct / 100 * t.count; }
        let capped = '';
        const gap = Math.max(t.cooldown, t.perTarget);
        if (gap > 0 && events > 1 / gap) { events = 1 / gap; capped = ' (at most once every ' + gap + ' s)'; }
        if (!(events > 0) || !(size > 0)) continue;
        let dps;
        if (t.element && mitig[t.element]) {
          const d = t.element, mt = mitig[d];
          let k = mt.k;
          if (d === 'Physical') { const dr = Math.min(H.ArmourMaxReduction, 100 * armour / (armour + H.ArmourFactor * size)); k = (1 - dr / 100) * (1 - mt.effRes / 100); }
          dps = size * events * k * mt.taken * shockF;
          byType[d] = (byType[d] || 0) + dps;
        } else {
          // no Element: the burst keeps the hit's own types and their mitigation
          dps = 0;
          for (const d of Object.keys(byType)) { const add = rawPerSec > 0 ? byType[d] * (size * events) / rawPerSec : 0; byType[d] += add; dps += add; }
        }
        hitDpsVs += dps; res.hitDps = hitDpsVs;
        use(m, 'trigger');
        const name = (m.src || '').replace(/^Passive · /, '');
        (res.triggers = res.triggers || []).push({ src: name, when: t.when, nth: t.nth, pct: t.pct, count: t.count, element: t.element, perSec: events, dps });
        const what = t.when === 'Hit' ? (t.nth > 1 ? 'every ' + t.nth + 'th hit' : 'every hit') + (t.state.length ? ' on a ' + (t.state.includes('VsBurningOrShocked') ? 'Burning or Shocked' : 'Burning') + ' enemy (' + Math.round(share * 100) + '% of the time)' : '')
          : t.when === 'Crit' ? 'every crit' : (t.nth > 1 ? 'every ' + t.nth + 'th use' : 'every use');
        res.notes.push(name + ': ' + what + ' adds ' + (t.count > 1 ? t.count + ' x ' : '') + t.pct + '% of the hit' + (t.element ? ' as ' + t.element : '') + capped + ', ' + events.toFixed(2) + ' a second = +' + Math.round(hitDpsNow > 0 ? dps / hitDpsNow * 100 : 0) + '% hit damage on one enemy (splash to others not counted).' + (/Pyre|Overclock/.test(name) ? '' : ' From the node text; not checked against the game yet.'));
      }
    }
    // Elemental Overload's buff: up for 8 s after any crit, so the share of time it is up is 1 - exp(-crits a second x 8).
    // Backdraft makes every Fire hit on an Ignited enemy a crit (ignite uptime from above). Elemental hit damage only: the
    // burn, other skills' crits and the skill panel figure are not counted (not checked against the game).
    if (overload) {
      const u = ail.ignite && ascFlag('Asc71_Backdraft') ? ail.ignite.uptime : 0;
      const critsPerSec = hitsPerSec * (u + (1 - u) * critChance / 100);
      const up = 1 - Math.exp(-critsPerSec * 8), ovF = 1 + 0.6 * up;
      for (const d of ['Fire', 'Cold', 'Lightning']) if (byType[d] !== undefined) { hitDpsVs += byType[d] * (ovF - 1); byType[d] *= ovF; }
      res.hitDps = hitDpsVs;
      res.overload = { uptime: up, critsPerSec, factor: ovF };
      res.notes.push('Elemental Overload: critical strikes grant 60% more elemental damage for 8 s, counted up ' + Math.round(up * 100) + '% of the time (' + critsPerSec.toFixed(1) + ' crits a second); your critical strike multiplier is fixed at 100%.');
    }
    res.poisonDps = poisonDps; res.igniteDps = igniteDps; res.bleedDps = bleedDps;
    // What the in-game skill panel shows: hits + ailments to one enemy, before its resistances and curses.
    res.panelDps = res.sheetHitDps * (1 + (hit.Physical ? hit.Physical.avg / (hitAvg || 1) : 0) * maimPct / 100) +(ail.poison ? ail.poison.perStack * ail.poison.panelStacks : 0) + (ail.ignite ? ail.ignite.dps1 * ail.ignite.burning : 0) + (ail.bleed ? ail.bleed.dps1 * ail.bleed.uptime : 0);
    // ----- Executioner (LowLifeMore, CullingStrike) -----
    // X% more damage below T% of life, and hits kill below C%. Against one enemy fought from full life this is a
    // fight average: the kill takes (1 - T) + (T - C) / (1 + X) of the plain time (Executioner: 25% / 35% / 10% =
    // x1.18). Counted on everything, damage over time too.
    let lowMore = 0, cull = 0;
    for (const m of pickMods(mods, 'LowLifeMore', 'Flat')) if (applies(ctx, m)) { lowMore += m.v; use(m); }
    for (const m of pickMods(mods, 'CullingStrike', 'Flat')) if (applies(ctx, m)) { cull = Math.max(cull, m.v); use(m); }
    if (lowMore || cull) {
      const tm = /below (d+)% of their life/i.exec((GD.supports.executioner || {}).Description || '');
      const T = (tm ? +tm[1] : 35) / 100, C = Math.min(cull / 100, T);
      const execF = 1 / ((1 - T) + (T - C) / (1 + lowMore / 100));
      for (const d of Object.keys(byType)) byType[d] *= execF;
      hitDpsVs *= execF; res.hitDps = hitDpsVs; poisonDps *= execF; igniteDps *= execF; bleedDps *= execF;
      res.poisonDps = poisonDps; res.igniteDps = igniteDps; res.bleedDps = bleedDps;
      res.executioner = { more: lowMore, below: T * 100, cull: C * 100, factor: execF };
      res.notes.push('Executioner: ' + lowMore + '% more damage below ' + Math.round(T * 100) + '% life and kills below ' + Math.round(C * 100) + '%: one enemy dies ' + Math.round((1 - 1 / execF) * 100) + '% sooner, counted as x' + execF.toFixed(2) + ' over the fight.');
    }
    // Bone Sovereign ("You deal no damage yourself.") and Ancestral Host ("You deal no damage with skills you use yourself
    // (totems, minions and conduits still do).") - their Price text in passive_tree.json, flag Keystone/NoHeroDamage.
    // Totems, Conduit casts and minions keep their damage; everything you use yourself (traps and Cast on Crit too) does none.
    // NOT CHECKED in a log; the skill panel figure is left as the game's sheet would show it.
    const noHero = mods.find(m => m.stat === 'Keystone' && m.mode === 'Flag' && (m.tags || []).includes('NoHeroDamage'));
    if (noHero && !res.totem && !res.conduit) {
      use(noHero, 'no damage yourself');
      for (const d of Object.keys(byType)) byType[d] = 0;
      hitDpsVs = 0; poisonDps = 0; igniteDps = 0; bleedDps = 0;
      res.hitDps = 0; res.poisonDps = 0; res.igniteDps = 0; res.bleedDps = 0;
      res.noHeroDamage = true;
      res.notes.push(noHero.src.replace(/^Passive · /, '') + ': you deal no damage with skills you use yourself, so this skill does 0 to the enemy (totems, minions and Conduit casts still deal theirs).');
    }
    res.totalDps = hitDpsVs + poisonDps + igniteDps + bleedDps;

    // ----- mana -----
    // Cost a use = skill ManaCost x the gem level's cost cut (Gem.ManaCostAtGemLevel) x each support's mana multiplier
    // x (1 + ManaCost lines). Regen = max mana (Hero ManaBase + ManaPerLevel x level + ManaPerInt x Int, + Mana lines)
    // x ManaRegenPct% a second (+ ManaRegen % lines, + flat mana a second such as Vow of Clarity's), plus Tithe's
    // mana a hit and mana leech of hit damage (at most Hero.LeechRatePct of max mana a second). Int at 100/200/300
    // (Hero.AttrPipAt) refunds ClarityRefundPct of each cost. Cast on Crit casts cost half.
    // Vows and Heralds reserve ReserveFlat + ReserveFlatPerLevel x (level - 1) + ReservePct of max mana (blessings.json;
    // the log: Clarity level 20 reserves 58, Herald of Embers 143 of 571). A deficit is fine if the mana left lasts:
    // ok = sustained, or at least 60 s of nonstop use from full (Guardian fights in the log last 8-27 s).
    // Not counted: mana on kill.
    res.mana = null;
    const bloodMagic = mods.some(m => m.stat === 'BloodMagic');
    const skipMana = bloodMagic ? 'paid with life (Blood Magic)' : !sk.ManaCost ? 'no mana cost' : res.conduit ? 'cast by the channel' : res.totem || shape === 'totem_support' || shape === 'trap_support' ? 'paid when placed' : sk.Channel ? 'a channel' : res.orbitRing ? 'a toggle' : '';
    if (!skipMana) {
      const flat = st => pickMods(mods, st, 'Flat').reduce((a, m) => a + m.v, 0), inc = st => pickMods(mods, st, 'Inc').reduce((a, m) => a + m.v, 0);
      const max = heroMaxMana(H, ch, mods, attr);
      const regen = max * (H.ManaRegenPct || 1.8) / 100 * Math.max(0, 1 + inc('ManaRegen') / 100) + flat('ManaRegen');
      const pips = (H.AttrPipAt || [100, 200, 300]).filter(t => (attr.Int || 0) >= t).length;
      const refund = pips ? ((H.ClarityRefundPct || [])[pips - 1] || 0) : 0;
      let mult = 1;
      // A support granted by an item or passive costs no extra mana: patch notes 5 Nov ("Ring of Echoing Oaths: the
      // granted Spell Echo line now shows the gem's own price, no 25% more mana cost"); The Last Volley's granted Rain
      // also lists only its damage price.
      for (const sp of res.supports) if (sp.ok && !sp.hostOnly && !sp.granted && !(o.off && o.off.has(sp.key))) { const sd = GD.supports[lc(sp.id)]; if (sd && sd.ManaMultiplier) mult *= sd.ManaMultiplier; }
      let costInc = 0; for (const m of pickMods(mods, 'ManaCost', 'Inc')) if (applies(ctx, m)) costInc += m.v;
      const cut = (G.ManaCostAtGemLevel || [])[L - 1] || 1;
      const cost = sk.ManaCost * cut * mult * Math.max(0, 1 + costInc / 100) * (res.coc ? 0.5 : 1) * (1 - refund / 100);
      const spend = cost * res.speed.usesPerSec;
      let onHit = 0; for (const m of pickMods(mods, 'ManaOnHit', 'Flat')) if (applies(ctx, m)) onHit += m.v;
      let leech = 0; for (const m of pickMods(mods, 'ManaLeech', 'Flat')) if (applies(ctx, m)) leech += m.v;
      const leechGain = Math.min(leech / 100 * hitDpsVs, max * (H.LeechRatePct || 20) / 100);
      const gain = regen + onHit * hitsPerSec + leechGain;
      let reserved = 0; const resInc = inc('Reservation');
      for (const b of Object.values(GD.blessings)) {
        const tryLvl = b.Skill && !ch.hotbar.includes(b.Skill) && /herald/i.test(b.Id) && o.tryHeralds && o.tryHeralds[b.Id] > 0 ? +o.tryHeralds[b.Id] : 0;
        if (!b.Skill || !(ch.hotbar.includes(b.Skill) || tryLvl) || (o.off && o.off.has('vow:' + b.Id))) continue;
        if (!b.ReserveFlat && !b.ReservePct) continue;
        const lvl = blessingGemLevel(GD, ch, b, mods, o, tryLvl);
        reserved += Math.round(((b.ReserveFlat || 0) + (b.ReserveFlatPerLevel || 0) * (lvl - 1) + (b.ReservePct || 0) / 100 * max) * Math.max(0, 1 + resInc / 100));
      }
      const pool = Math.max(0, max - reserved), deficit = spend - gain;
      const lasts = deficit > 0 ? pool / deficit : Infinity;
      res.mana = { max, reserved, pool, regen, cost, mult, costInc, cut, refund, spend, onHit: onHit * hitsPerSec, leech: leechGain, gain, sustained: deficit <= 0, lasts, ok: lasts >= 60 };
    } else res.mana = { skip: skipMana };

    // Lines that matched this skill but that the model does not use.
    res.notModelled = [];
    for (const m of mods) {
      if (res.used.has(m) || m.local) continue;
      // A Trigger line's tags are its kind and parameters, not conditions: list it when its skill kinds suit this skill
      // (Kill, Roll, Block, WhenHit and MinionDeath triggers, and support triggers, are not counted above).
      if (m.stat === 'Trigger') {
        const t = trigParse(m);
        if (condsOk(ctx, t.conds) && t.types.every(d => ctx.tags.has(lc(d)))) res.notModelled.push(m);
        continue;
      }
      if (NON_DAMAGE.has(m.stat) || HANDLED.has(m.stat)) continue;
      if (/^Minion/.test(m.stat) && !ctx.tags.has('minion')) continue;
      if (/^Totem/.test(m.stat) && !res.totem && !ctx.tags.has('totem')) continue; // totem count and speed: counted on totems
      if (m.stat === 'IgniteStacks' && !ail.ignite) continue; // counted where the skill ignites
      const { conds } = splitTags(m.tags);
      if (!condsOk(ctx, conds)) continue;
      res.notModelled.push(m);
    }
    if (offBase && offBase.DamageMin && isAttack) res.notes.push('Off-hand weapon found: dual wielding alternates weapons in game; this sheet uses the main hand only.');
    // A Cast on Crit spell's skill panel (in-game tooltip) counts it as cast by hand: its own cast time and no
    // "25% less" (Ember Bolt tooltip 1 Nov: 67-108, 293 DPS = the sim without the trigger, exactly). The real
    // rate and damage (triggered casts, 25% less) stay in the "vs enemy" numbers.
    if (res.coc && !o._panelPass) {
      const p = calcSkill(GD, ch, skillId, Object.assign({}, o, { coc: false, _col: col, _panelPass: true }));
      if (p && isFinite(p.panelDps)) { res.cocPanel = { triggered: res.panelDps }; res.panelDps = p.panelDps; }
    }
    // Kills that rise as minions (Marrow Lance, Grave Reap): worked out as a minion sheet from the skill's base damage.
    // The game's skill panel for these skills is the minions' DPS (tooltip: "672 DPS (all its minions)").
    if (sk.Minion && sk.Minion.MonsterId && !isSummon(sk) && !o.armyProbe && !o._risen && res.baseParts) {
      const r2 = { skillId, notes: [], used: new Map(), gem: res.gem };
      minionSheet(GD, ch, sk, r2, mods, () => {}, attr, L, Object.assign({}, o, { minionSpec: res.baseParts, _risen: true }));
      res.risen = { dps: r2.totalDps, hit: r2.hitAvg, alive: r2.minion.alive, pace: r2.minion.pace, more: r2.minion.more, inc: r2.minion.inc };
      res.ownPanelDps = res.panelDps;
      res.panelDps = r2.totalDps;
      res.notes = res.notes.filter(n => !/they are not counted here/.test(n));
      res.notes.push(sk.Name + ': the game\'s skill panel shows its risen minions only: ' + r2.minion.alive + ' standing, hit ' + Math.round(r2.hitAvg) + ', every ' + r2.minion.pace.toFixed(3) + ' s = ' + Math.round(r2.totalDps) + ' DPS (the panel number). The lance\'s own hits (' + Math.round(res.ownPanelDps) + ' DPS) and the minions are not added into the vs-enemy numbers.');
    }
    return res;
  }

  // Minions (summon gems). Worked out from the game's own minion sheet in the log ("PetSheet68" / "PetHit68")
  // and three skill panels (2 Nov, Necromancer level 11: Grave Golem 263, Skeletal Mage 94, Skeletons 176 DPS):
  //   hit  = SpellMin..SpellMax x 1.19^(gem level - 1) x the gem's DamageMult x Str/Int affinity
  //          x 60% more near you x (1 + increased Minion Damage, +1% per 10 Int) x the supports' more x Harmony
  //   pace = AttackEvery x 0.72 / minion speed;   DPS = average hit x crit x minions / pace.
  // The 0.72 is measured (every PetSheet line: Skeletons 0.8 s -> 0.576 s, Golem 1.05 -> 0.756), not in the data.
  // The Grave Golem grows with the level of the zone it fights in (not the hero's: hero 24 showed x1.10 in an area
  // level 10 zone, x1.23 at Rupture 26). Fitted to 24 log readings (PetHit68 'level', area levels 6-26) and the
  // panel's 'x1.23 damage now' at Rupture 26: 1 + LevelDamage x 0.0887 x level^0.87 (LevelDamage 0.15).
  // Beyond level 26 it is the same curve carried on (not yet checked deeper).
  const MINION_PACE = 0.72, MINION_NEAR = 60, MINION_LEVEL_K = 0.0887, MINION_LEVEL_P = 0.87;
  function minionSheet(GD, ch, sk, res, mods, use, attr, L, o) {
    const H = GD.scaling.Hero, G = GD.scaling.Gem, mi = sk.Minion;
    const tags = new Set([...(sk.Tags || []), sk.Delivery].map(lc));
    // A line counts when its non-element tags all name the minion skill ("Minion lines that also name Spell,
    // Physical ..."); element tags pick the damage type it scales.
    const fit = m => { const { types, conds } = splitTags(m.tags); return conds.every(c => tags.has(lc(c))) ? types : null; };
    const fromSupport = m => { const k = String(m.key || ''); return k.startsWith('support:') && forMinions(GD.supports[k.slice(8)]); };
    // Gear levels past +5 grow minion skills x1.08 each (patch notes 5 Nov: "Minion skills: 8% a level"; was x1.04);
    // the 0.56 curve with its data (minionFade).
    const growth = res.gem ? spellLevelGrowth(G.DamageGrowth || 1.19, res.gem.own, res.gem.bonus, minionFade(GD)) :Math.pow(G.DamageGrowth || 1.19, L - 1);
    const d0 =DT.includes(sk.DamageType) ? sk.DamageType : 'Physical';
    const parts = {}; DT.forEach(d => parts[d] = [0, 0]);
    parts[d0] = [sk.SpellMin * growth, sk.SpellMax * growth];
    // Risen minions (Marrow Lance, Grave Reap): the spec hit is the skill's own base damage (weapon + gem, before
    // increases and conversion), not SpellMin..SpellMax. Game 9 Nov 2026 (Shrimpsum): tooltip minion damage Physical
    // 24-43 + Cold 19-33 + Poison 36-64 = 109.5 at gem 11; PetSheet68 'marrow_lance avg 107-108' (gem 11) and
    // 'spec avg 128' (gem 12); the sim's base parts give 110.4 / 126.3. Skill panel '672 DPS (all its minions)' =
    // 4 x hit 113 / 0.673 s.
    if (o.minionSpec) for (const d of DT) parts[d] = o.minionSpec[d] ? [o.minionSpec[d][0], o.minionSpec[d][1]] : [0, 0];
    // More lines: the summon's own supports only (your own damage lines do not reach minions). Ruthless (made into
    // an averaged Physical more line in calcSkill) is kept out of the hit: the game's panel shows the hit without it
    // and counts it in the DPS only (Grave Golem 2 Nov: 248-454 with or without it, DPS 2,015 -> 2,325).
    const isRuthless = m => / \(every 3rd blow, averaged\)$/.test(m.src || '');
    let ruthPct = 0;
    for (const m of mods) if (fromSupport(m) && isRuthless(m)) { ruthPct += m.v; use(m, 'minion, in the DPS'); }
    const moreFor = d => {
      let k = 1;
      for (const m of mods) {
        if (!fromSupport(m) || m.mode !== 'More' || isRuthless(m)) continue;
        const t = fit(m); if (!t || (t.length && !t.includes(d))) continue;
        if (m.stat === 'Damage') { k *= 1 + m.v / 100; use(m, 'minion'); }
      }
      return k;
    };
    const scaled = {}; for (const d of DT) { const k = moreFor(d); scaled[d] = [parts[d][0] * k, parts[d][1] * k]; }
    // "Gain X% of physical as extra fire" (Added Fire on a golem): taken from the physical after its own more lines.
    for (const m of mods) if (fromSupport(m) && m.stat === 'DamageAsExtra' && m.mode === 'Flat') {
      const t = splitTags(m.tags).types; if (t.length < 2) continue;
      scaled[t[1]][0] += scaled[t[0]][0] * m.v / 100; scaled[t[1]][1] += scaled[t[0]][1] * m.v / 100; use(m, 'minion');
    }
    const minionNoElem = mods.filter(m => fromSupport(m) && isNoElem(m));
    if (minionNoElem.length) {
      const lost = ELEMENTS.filter(d => scaled[d][1] > 0);
      for (const d of ELEMENTS) scaled[d] = [0, 0];
      minionNoElem.forEach(m => use(m, 'minion, no elemental damage'));
      if (lost.length) res.notes.push('Brutality: these minions deal no elemental damage, so the ' + lost.join(', ') + ' from other supports is lost (the game shows those supports "idle").');
    }
    const incFor = d => {
      let v = attr.Int / 10 * (H.IntMinionDamagePer10 || 0);
      for (const m of pickMods(mods, 'MinionDamage', 'Inc')) { const t = fit(m); if (t && (!t.length || t.includes(d))) { v += m.v; use(m, 'minion'); } }
      return v;
    };
    let minionMore = 1;
    for (const m of pickMods(mods, 'MinionDamage', 'More')) if (fit(m)) { minionMore *= 1 + m.v / 100; use(m, 'minion'); }
    // Harmony: "X% more Damage for each different kind of Minion you command (up to 4 kinds)". Kinds = the summon gems
    // on your bar (each raised); the 2 Nov Skeletons panel with all four out fits 1 + 5% x 4.
    const kinds = Math.max(1, Math.min(4, o.minionKinds || new Set(ch.hotbar.filter(id => { const k = GD.skills[lc(id)]; return isSummon(k) && k.Minion && k.Minion.MonsterId; })).size));
    let kind = 1;
    for (const m of pickMods(mods, 'MinionKindMore', 'Flat')) { kind *= 1 + m.v / 100 * kinds; use(m, 'minion, ' + kinds + ' kinds'); }
    // A Grave Golem on your bar blesses every minion near it by its supports' element, itself included: flame (fire
    // supports) 12.5% more damage, storm (lightning) 15% faster. The game's panel counts it (2 Nov Skeletons and Golem).
    const golem = golemBlessing(GD, ch, sk, o);
    if (golem && golem.stat === 'MinionDamage') minionMore *= 1 + golem.v / 100;
    if (o.graveCall) minionMore *= 1.3; // Grave Call: 30% more damage (speed is added below)
    const aff = mi.Affinity && mi.AffinityDamage ? 1 + Math.min(mi.AffinityCap || 50, (attr[mi.Affinity] || 0) * mi.AffinityDamage) / 100 : 1;
    const near = o.minionNear === false ? 1 : 1 + MINION_NEAR / 100;
    const zoneLevel = o.enemyLevel || ch.level;
    const lvlK = mi.LevelDamage ? 1 + mi.LevelDamage * MINION_LEVEL_K * Math.pow(Math.max(1, zoneLevel), MINION_LEVEL_P) : 1;
    const base = (mi.DamageMult || 1) * aff * near * minionMore * kind * lvlK;
    const hit = {}; let avg = 0;
    for (const d of DT) {
      if (!(scaled[d][1] > 0)) continue;
      const k = base * (1 + incFor(d) / 100);
      hit[d] = { min: scaled[d][0] * k, max: scaled[d][1] * k }; hit[d].avg = (hit[d].min + hit[d].max) / 2; avg += hit[d].avg;
    }
    const chance = H.SpellCritBase || 6, multi = H.CritMultiBase || 150, critFactor = 1 + chance / 100 * (multi / 100 - 1);
    // How many stand at once: the gem's Cap, one more every CountEvery gem levels or at PerLevels, + MinionCap lines.
    let alive = (mi.Cap || mi.Count || 1) + (mi.CountEvery ? Math.floor((L - 1) / mi.CountEvery) : 0) + (mi.PerLevels || []).filter(l => L >= l).length;
    // The Grave Golem is one at a time ("Only one answers at a time"): +minion lines do not add golems (the log's
    // PetSheet68 always has the golem at cap 1 while the same lines take Skeletons to 10-12).
    const oneOnly = !!mi.GolemAuras;
    if (oneOnly) alive = 1;
    else for (const m of pickMods(mods, 'MinionCap', 'Flat')) if (fit(m)) { alive += m.v; use(m, 'minion'); }
    // One army across all your summon skills. Game log 6 Nov (build 26474163): "ArmyBack81: ON - army 40 in all,
    // past 27 each body adds 0.50 of a body (a full army: each blow x0.837, 33.5 bodies of damage)" and
    // "army 3 standing (total 40) -> each blow x1.000 = 3.0 bodies of damage"; patch notes 4 Nov ("the total is back
    // to 40 (was 27), and each minion past 27 adds a little less"). ArmyEngaged82 (patch 0.54) counts only bodies
    // that struck in the last 2.5 s: the sheet assumes the whole army is fighting.
    // Past 40 "your oldest one goes": which skill loses them depends on summon order, so each kind keeps its share.
    const army = o.armyProbe ? null : armyCount(GD, ch, sk, alive, o);
    let armyK = 1;
    if (army) {
      if (army.total > ARMY_TOTAL && !oneOnly) alive = Math.max(1, Math.round(alive * ARMY_TOTAL / army.total));
      const standing = Math.min(ARMY_TOTAL, army.total);
      armyK = armyBodies(standing) / standing;
    }
    let strikes = 1;
    // Multistrike's extra strikes count for shooting minions (Skeletal Mage) too, each at its 52% less (2 Nov boss
    // tests: bolt 2126 with it, 4489 without). Until the 5 Nov patch the repeats showed as a blood puff, not a bolt, which is
    // why the 2 Nov test saw "no extra bolts"; patch notes 5 Nov: "the mage now throws its bolt 2 more times". The developer's replay (Discord, 5 Nov): the Mages fire their repeats and the real
    // damage reached 94% of the game's panel, which counts all 3 strikes. The sheet follows the panel.
    const ranged = (sk.Tags || []).includes('Projectile');
    let shotRepeats = false;
    for (const m of mods) if (fromSupport(m) && m.stat === 'MinionStrikes' && m.mode === 'Flat') { if (ranged) shotRepeats = true; strikes += m.v; use(m, 'minion'); }
    let spInc = 0, spMore = 1;
    for (const m of pickMods(mods, 'MinionSpeed', 'Inc')) if (fit(m)) { spInc += m.v; use(m, 'minion'); }
    // 0.56.3 (patch notes 7 Nov 20:57: "Skeletal Mages follow Faster Casting"; the support's text: "On a summon of casters
    // (Skeletal Mage): they cast 25% faster"): a linked Faster Casting speeds up shooting minions.
    const casterMinions = is0563(GD) && ranged;
    for (const m of mods) if ((m.stat === 'MinionSpeed' || (m.stat === 'AttackSpeed' && fromSupport(m)) || (casterMinions && m.stat === 'CastSpeed' && m.key === 'support:faster_casting')) && m.mode === 'More' && fit(m)) { spMore *= 1 + m.v / 100; use(m, 'minion'); }
    if (golem && golem.stat === 'MinionSpeed') spMore *= 1 + golem.v / 100;
    // Grave Call up (page checkbox): 30% more damage, moving and attacking 20% faster for 4 s (gem text and log 9 Nov 2026:
    // "Minion: grave_call called 15 minions to the hero (30% more damage for 4.0 s)"). The game's panel does not include it
    // (PetSheet68 at 06:32:37, 7 s after a call: pace 0.534 s, unchanged), so it is off by default.
    if (o.graveCall) { spMore *= 1.2; res.notes.push('Grave Call active: minions deal 30% more damage and attack 20% faster (lasts 4 s after each cast; not in the game\'s panel).'); }
    const pace = (mi.AttackEvery || 1) * MINION_PACE / Math.max(0.05, (1 + spInc / 100) * spMore);
    const hitsPerSec = alive * strikes / pace;
    const physShare = avg > 0 && hit.Physical ? hit.Physical.avg / avg : 0;
    const ruthK = 1 + ruthPct / 100 * physShare;
    const dps = avg * critFactor * hitsPerSec * ruthK * armyK;
    res.attr = attr;
    res.base = { kind: 'minion', min: sk.SpellMin, max: sk.SpellMax, growth };
    res.hit = hit; res.hitAvg = avg; res.hitAvgCrit = avg * critFactor;
    res.crit = { base: chance, inc: 0, chance, multi, factor: critFactor };
    res.speed = { inc: spInc, more: spMore, animRate: 1, rateMult: (1 + spInc / 100) * spMore, usesPerSec: hitsPerSec, useTime: pace, cooldown: sk.Cooldown || 0, stat: 'MinionSpeed', hitFactor: 1 };
    res.hits = { repeats: 0, projectiles: 0, projOnTarget: 1, projWeight: 1, perHitFactor: 1, strikes, hitsPerUse: 1, hitsPerSec, fullHitsPerSec: hitsPerSec };
    res.ailments = {}; res.notModelled = []; res.poisonDps = 0; res.igniteDps = 0; res.bleedDps = 0;
    res.sheetHitDps = res.panelDps = res.hitDps = res.totalDps = dps;
    res.minion = { monster: mi.MonsterId, alive, strikes, pace, every: mi.AttackEvery, dmgMult: mi.DamageMult || 1, affinity: aff, affinityAttr: mi.Affinity, near, inc: incFor(d0), more: minionMore / (golem && golem.stat === 'MinionDamage' ? 1 + golem.v / 100 : 1) * moreFor(d0), kind, kinds, golem, ruthless: ruthK, level: lvlK, growth };
    res.notes.push('Minions: ' + alive + ' ' + (alive === 1 ? 'stands' : 'stand') + ' at once' + (strikes > 1 ? ', each blow striking ' + strikes + ' times' : '') + ', each attacking every ' + pace.toFixed(3) + ' s (' + mi.AttackEvery + ' s x 0.72' + (spInc || spMore !== 1 ? ' / minion speed x' + ((1 + spInc / 100) * spMore).toFixed(2) : '') + '). The DPS is the game\'s own skill panel number: every minion attacking nonstop, before the enemy\'s resistances and curses. In fights they also walk and pick targets (the log\'s MinionPace counts their real blows).');
    if (near > 1) res.notes.push('Counted at your side: minions deal ' + MINION_NEAR + '% more within 7 m of you (fading to none at 12 m), as the game\'s panel counts it.');
    if (mi.LevelDamage) res.notes.push(sk.Name + ' also grows with the level of the zone it fights in (the Monster level box): x' + lvlK.toFixed(3) + ' at level ' + zoneLevel + '. Fitted to the game\'s log and panel at zone levels 6-26 (x1.23 at Rupture 26); deeper Ruptures carry the same curve on, not yet checked.');
    if (kind !== 1) res.notes.push('Harmony: ' + kinds + ' kind' + (kinds > 1 ? 's' : '') + ' of minion on your bar, ' + Math.round((kind - 1) * 100) + '% more damage.');
    if (shotRepeats) res.notes.push('Multistrike on ' + sk.Name + ': each blow strikes ' + strikes + ' times at Multistrike\'s 52% less, as the game\'s panel counts it. Since the 5 Nov patch the mage throws a bolt for each repeat.');
    if (golem && golem.stat !== 'EnemyTaken') res.notes.push('Your ' + golem.name + ' blesses minions near it, itself included: ' + golem.text + ' (counted, as the game\'s panel does).');
    if (army && (army.parts.length > 1 || army.total > ARMY_FULL)) {
      const standing = Math.min(ARMY_TOTAL, army.total);
      res.notes.push('Your army: ' + army.parts.map(p => p.n + ' ' + p.name).join(', ') + ' (' + army.total + ' in all' + (army.total > ARMY_TOTAL ? ', at most ' + ARMY_TOTAL + ' stand: past that your oldest go, counted here as each kind losing its share' : '') + ').' + (armyK < 1 ? ' Past ' + ARMY_FULL + ' each minion adds half a minion of damage, so every blow deals x' + armyK.toFixed(3) + ' (' + armyBodies(standing).toFixed(1) + ' minions of damage from ' + standing + ').' : ''));
    }
    res.minion.army = army ? { total: army.total, k: armyK } : null;
    if (ruthK > 1) res.notes.push('Ruthless: every third blow deals ' + Math.round(ruthPct * 3) + '% more physical damage, averaged into the DPS (x' + ruthK.toFixed(3) + '); the hit above leaves it out, as the game\'s panel does.');
    return res;
  }

  // Bodies of damage from n standing: full up to 27, half past it (40 -> 33.5, the log's "each blow x0.837").
  function armyBodies(n) { return Math.min(n, ARMY_FULL) + ARMY_PAST * Math.max(0, n - ARMY_FULL); }

  // Every summon on the bar with its count (this skill's from the sheet being built). Each other one is worked
  // out with its own sheet (armyProbe stops it counting the army again).
  function armyCount(GD, ch, sk, alive, o) {
    const parts = [{ name: sk.Name, n: alive }];
    const seen = new Set([sk]);
    for (const id of ch.hotbar || []) {
      const k = GD.skills[lc(id)];
      if (!k || seen.has(k) || !k.Minion || !k.Minion.MonsterId) continue;
      // Skills whose kills rise as minions (Marrow Lance, Grave Reap: "up to 3, one more at gem levels 7, 13, 19")
      // stand in the same army. Game log 9 Nov 2026 (Shrimpsum, Marrow Lance gem 11, 11 summons on the bar):
      // "MinionPace: 62 blows in 10 s by 15 minions", "PetSheet68: marrow_lance ... cap 4", "MinionFollow87: on
      // marrow_lance carried 4, the sheet's cap reads 4" = 11 + 4. Their own damage is not in any panel here.
      if (!isSummon(k)) {
        seen.add(k);
        const lv = (ch.gemLevels || {})[lc(id)] || (ch.gemLevels || {})[id] || 1;
        parts.push({ name: k.Name + ' (risen)', n: (k.Minion.Cap || k.Minion.Count || 1) + (k.Minion.PerLevels || []).filter(l => lv >= l).length });
        continue;
      }
      seen.add(k);
      const r = calcSkill(GD, ch, id, Object.assign({}, o, { armyProbe: true }));
      const n = r.minion ? r.minion.alive : (k.Minion.GolemAuras ? 1 : (k.Minion.Cap || k.Minion.Count || 1));
      parts.push({ name: k.Name, n });
    }
    return { total: parts.reduce((a, p) => a + p.n, 0), parts };
  }

  // The Grave Golem's blessing: its element comes from the supports in its sockets (the first non-physical element
  // they add or convert to). Fire: 12.5% more minion damage; Lightning: 15% faster minions; the others do not
  // change minion damage. Needs the golem gem on the bar.
  function golemBlessing(GD, ch, sk, o) {
    if (o.golemAura === false) return null;
    const gid = ch.hotbar.find(id => { const k = GD.skills[lc(id)]; return k && k.Minion && k.Minion.GolemAuras; });
    if (!gid) return null;
    const g = GD.skills[lc(gid)];
    const sups = lc(gid) === lc(sk.Id) && o.supportsOverride ? o.supportsOverride : ((ch.sockets.find(s => lc(s.skill) === lc(gid)) || {}).supports || []);
    let el = null;
    for (const id of sups) {
      const sp = GD.supports[lc(id)]; if (!sp || el) continue;
      for (const m of sp.Mods || []) {
        const types = splitTags(m.Tags || []).types;
        // Venom / Flame / Ice / Storm supports are one-tag Converts (Tags ["Poison"]): the tag is the new element
        // (tooltip 9 Nov 2026: Venom Support on the Grave Golem shows Element Poison and the venom golem's blessing).
        const to = m.Stat === 'Convert' ? (types[1] || types[0]) : m.Stat === 'DamageAsExtra' ? types[1] : m.Stat === 'AddedDamage' ? types[0] : null;
        if (to && to !== 'Physical') { el = to; break; }
      }
    }
    // Brutality on the golem: no elemental damage, so no fire/ice/storm golem (2 Nov log: plain grave golem).
    const brutal = sups.some(id => ((GD.supports[lc(id)] || {}).Mods || []).some(m => isNoElem({ stat: m.Stat, mode: m.Mode, tags: m.Tags })));
    if (brutal && ELEMENTS.includes(el)) el = null;
    const a =(g.Minion.GolemAuras || {})[el || 'Default'];
    if (!a || !['MinionDamage', 'MinionSpeed', 'EnemyTaken'].includes(a.Stat)) return null;
    const name = el === 'Fire' ? 'flame golem' : el === 'Lightning' ? 'storm golem' : el === 'Poison' ? 'venom golem' : 'golem';
    return { element: el, stat: a.Stat, v: a.Value, name, text: a.Stat === 'MinionDamage' ? a.Value + '% more damage' : a.Stat === 'EnemyTaken' ? 'enemies take ' + a.Value + '% more damage' : a.Value + '% faster' };
  }

  function earlyDamage(cls, level) {
    if (!cls.EarlyDamagePct) return 1;
    const full = cls.EarlyDamageFullToLevel || 0, end = cls.EarlyDamageEndLevel || 0;
    if (level <= full) return 1 + cls.EarlyDamagePct / 100;
    if (level >= end) return 1;
    return 1 + cls.EarlyDamagePct / 100 * (end - level) / Math.max(1, end - full);
  }

  // Hero maximum life: (Hero LifeBase + LifePerLevel x level + LifePerStr x Str + flat Life lines + DexLife per
  // 10 Dex) x (1 + increased Life) x (1 + more Life). Checked 6 Nov against the game log: Shrimpslam (Warrior 19,
  // 119 Str, 163 flat life on gear) gives 571 here; the Guardian's crushing-blow line says "the hero's 572 life".
  function heroMaxLife(GD, ch, mods, attr) {
    const H = GD.scaling.Hero || {};
    let flat = 0, inc = 0, more = 1;
    for (const m of mods) {
      if (splitTags(m.tags).conds.length) continue;
      if (m.stat === 'Life') { if (m.mode === 'Flat') flat += m.v; else if (m.mode === 'Inc') inc += m.v; else if (m.mode === 'More') more *= 1 + m.v / 100; }
      else if (m.stat === 'DexLife' && m.mode === 'Flat') flat += m.v * (attr.Dex || 0) / 10;
    }
    const base = (H.LifeBase || 130) + (H.LifePerLevel || 11.5) * ch.level + (H.LifePerStr || 0.5) * (attr.Str || 0) + flat;
    return base * Math.max(0, 1 + inc / 100) * more;
  }
  // Estimated Armour, Evasion, Energy Shield, Life or Block chance for the 0.56.5 defence engine. Armour / Evasion / ES:
  // each item's base value + its local flat, x its local increases (the stat or Defences), plus global flat, x (global
  // increases + the attribute's 4% per 10: Str armour, Dex evasion, Int ES) x "more" lines. Block: the shield's base block
  // + flat Block lines, capped at Hero.BlockMax (75 in 0.56.5). Same method as the 0.56.4 Hammer of Judgement estimate;
  // NOT CHECKED against the game's character panel.
  function defenceTotal(GD, ch, mods, attr, stat) {
    const H = GD.scaling.Hero || {};
    const plain = m => !splitTags(m.tags).conds.length;
    if (stat === 'Life') return heroMaxLife(GD, ch, mods, attr);
    if (stat === 'Block') {
      let b = 0;
      for (const it of ch.items || []) { const base = GD.bases[lc(it.base)]; if (base && base.Block) b += base.Block; }
      b += mods.filter(m => m.stat === 'Block' && m.mode === 'Flat' && plain(m)).reduce((x, m) => x + m.v, 0);
      return clamp(b, 0, H.BlockMax || 75);
    }
    const attrInc = { Armour: (H.StrArmourPctPer10 || 0) * (attr.Str || 0), Evasion: (H.DexEvasionPctPer10 || 0) * (attr.Dex || 0), EnergyShield: (H.IntEsPctPer10 || 0) * (attr.Int || 0) }[stat] / 10 || 0;
    let flat = mods.filter(m => !m.local && m.stat === stat && m.mode === 'Flat' && plain(m)).reduce((x, m) => x + m.v, 0);
    // Flat ES from Intelligence (Hero.EsPerInt79 = 0.5 per Int, as in the page's Character tab). Character panel, 10 Nov 2026
    // (Shrimpmage, Int 652): Energy Shield 6,138 without Vow of Warding, 7,549 with it (x1.23 = its 23% more at gem 7). Without
    // this line the sim had 4,387 / 5,396; with it 6,122 / 7,532 (within 0.3%).
    if (stat === 'EnergyShield') flat += (H.EsPerInt79 || 0) * (attr.Int || 0);
    for (const it of ch.items || []) {
      const b = GD.bases[lc(it.base)]; if (!b || !b[stat]) continue;
      const key = 'item:' + it.slot, loc = mods.filter(m => m.local && m.key === key);
      const lf = loc.filter(m => m.stat === stat && m.mode === 'Flat').reduce((x, m) => x + m.v, 0);
      const li = loc.filter(m => m.mode === 'Inc' && (m.stat === stat || m.stat === 'Defences')).reduce((x, m) => x + m.v, 0);
      flat += (b[stat] + lf) * (1 + li / 100);
    }
    const gi = mods.filter(m => !m.local && m.mode === 'Inc' && (m.stat === stat || m.stat === 'Defences') && plain(m)).reduce((x, m) => x + m.v, 0) + attrInc;
    const more = mods.filter(m => !m.local && m.mode === 'More' && m.stat === stat && plain(m)).reduce((x, m) => x * (1 + m.v / 100), 1);
    return Math.max(0, flat * (1 + gi / 100) * more);
  }

  // Weapon damage with its local lines (local % physical, local added damage, local speed and crit).
  // extraBase: physical added to the weapon's base roll (Rending Slam's share of max life), before local % lines.
  function weaponStats(GD, item, base, mods, use, extraBase) {
    const dmg = {}; DT.forEach(d => dmg[d] = [0, 0]);
    if (!base || !base.DamageMin) { dmg.Physical = [2, 5]; return { name: 'Unarmed', dmg, aps: 1.2, crit: GD.scaling.Hero.CritBase }; }
    const key = 'item:' + item.slot;
    let physInc = 0, asInc = 0, critInc = 0;
    const added = {}; DT.forEach(d => added[d] = [0, 0]);
    for (const m of mods) {
      if (!m.local || m.key !== key) continue;
      const { types } = splitTags(m.tags);
      if (m.stat === 'Damage' && m.mode === 'Inc' && (!types.length || types.includes('Physical'))) { physInc += m.v; use(m, 'local'); }
      else if (m.stat === 'AddedDamage' && types.length) { added[types[0]][0] += m.v; added[types[0]][1] += m.v2; use(m, 'local'); }
      else if (m.stat === 'AttackSpeed' && m.mode === 'Inc') { asInc += m.v; use(m, 'local'); }
      else if (m.stat === 'CritChance' && m.mode === 'Inc') { critInc += m.v; use(m, 'local'); }
    }
    // Weapon quality is increased local Physical damage: Ballista swap tests 5 Nov, the Iron Reaver (173% local, quality 10)
    // hits 3.5% over the sheet without it, (1 + 1.83) / (1 + 1.73) = 1.037; a plain quality-0 bow matches.
    physInc += item.quality || 0;
    const xb = extraBase || 0;
    dmg.Physical = [(base.DamageMin + xb + added.Physical[0]) * (1 + physInc / 100), (base.DamageMax + xb + added.Physical[1]) * (1 + physInc / 100)];
    for (const d of DT) if (d !== 'Physical') dmg[d] = added[d];
    return { name: base.Name, dmg, aps: (base.AttacksPerSecond || 1) * (1 + asInc / 100), crit: (base.Crit || GD.scaling.Hero.CritBase) * (1 + critInc / 100), physInc, isStaff: lc(base.Class) === 'staff' };
  }

  function clone(p) { const o = {}; for (const k in p) o[k] = p[k].slice(); return o; }

  // Skills worth offering for a character: hotbar first, then socketed, then every owned gem.
  // all: also every other skill with a hit (planning with gems you don't own; gem level = what your level allows).
  function listSkills(GD, ch, all) {
    const seen = new Set(); const out = [];
    const push = (id, where) => { if (!id || id === 'move' || seen.has(id) || !GD.skills[lc(id)]) return; seen.add(id); out.push({ id, where, name: GD.skills[lc(id)].Name }); };
    ch.hotbar.forEach(id => push(id, 'Hotbar'));
    ch.sockets.forEach(s => push(s.skill, 'Socketed'));
    const w = ch.items.find(i => i.slot === 'MainHand'); const wb = w && GD.bases[lc(w.base)];
    ch.gems.forEach(id => push(id, 'Owned gem'));
    if (all) for (const s of Object.values(GD.skills)) if (s.Kind !== 'Basic' && (s.SpellMin || (s.Tags || []).includes('Attack')) && !isSummon(s)) push(lc(s.Id), 'Other skills (not owned: gem level from your character level)');
    return out;
  }

  // What would help most: DPS change from one small upgrade at a time.
  function statWeights(GD, ch, skillId, o, baseRes) {
    const base = baseRes.totalDps; if (!(base > 0)) return [];
    // Minion skills: the lines that reach minions (your own damage lines do not). No +minion row for the Grave Golem
    // (only one at a time).
    if (baseRes.minion) {
      const sk = GD.skills[lc(skillId)] || {};
      const oneOnly = !!(sk.Minion && sk.Minion.GolemAuras);
      const tests = [
        ['+1 to level of this gem', { Stat: 'SkillLevel', Mode: 'Flat', Tags: [], Value: 1 }],
        ['+20% increased Minion Damage', { Stat: 'MinionDamage', Mode: 'Inc', Tags: [], Value: 20 }],
        ['10% more Minion Damage', { Stat: 'MinionDamage', Mode: 'More', Tags: [], Value: 10 }],
        ['+10% increased Minion Speed', { Stat: 'MinionSpeed', Mode: 'Inc', Tags: [], Value: 10 }],
        ['10% more Minion Speed', { Stat: 'MinionSpeed', Mode: 'More', Tags: [], Value: 10 }],
        ...(oneOnly ? [] : [['+1 Minion Cap', { Stat: 'MinionCap', Mode: 'Flat', Tags: [], Value: 1 }]]),
        ['+50 Intelligence', { Stat: 'Int', Mode: 'Flat', Tags: [], Value: 50 }],
      ];
      return tests.map(([label, mod]) => {
        const r = calcSkill(GD, ch, skillId, Object.assign({}, o, { extra: (o.extra || []).concat([Object.assign({ src: 'What-if' }, mod)]) }));
        return { label, dps: r.totalDps, gain: r.totalDps / base - 1 };
      }).sort((a, b) => b.gain - a.gain);
    }
    const main = Object.keys(baseRes.hit).sort((a, b) => baseRes.hit[b].avg - baseRes.hit[a].avg)[0];
    const sp = baseRes.speed.stat;
    const tests = [
      ['+1 to level of this gem', { Stat: 'SkillLevel', Mode: 'Flat', Tags: [], Value: 1 }],
      ['+20% increased Damage', { Stat: 'Damage', Mode: 'Inc', Tags: [], Value: 20 }],
      ['+20% increased ' + main + ' Damage', { Stat: 'Damage', Mode: 'Inc', Tags: [main], Value: 20 }],
      ['10% more Damage', { Stat: 'Damage', Mode: 'More', Tags: [], Value: 10 }],
      ['+10% increased ' + (sp === 'CastSpeed' ? 'Cast' : 'Attack') + ' Speed', { Stat: sp, Mode: 'Inc', Tags: [], Value: 10 }],
      ['+30% increased Critical Strike Chance', { Stat: 'CritChance', Mode: 'Inc', Tags: [], Value: 30 }],
      ['+30% to Critical Strike Multiplier', { Stat: 'CritMulti', Mode: 'Flat', Tags: [], Value: 30 }],
      ['10% ' + main + ' Penetration', { Stat: 'Penetration', Mode: 'Flat', Tags: [main], Value: 10 }],
    ];
    if (baseRes.ailments.poison || baseRes.hit.Poison) {
      tests.push(['+20% increased Poison Damage (ailment)', { Stat: 'PoisonDamage', Mode: 'Inc', Tags: [], Value: 20 }]);
      tests.push(['+10% Damage over Time Multiplier', { Stat: 'DotMulti', Mode: 'Flat', Tags: [], Value: 10 }]);
      tests.push(['+10% chance to Poison', { Stat: 'PoisonChance', Mode: 'Flat', Tags: [], Value: 10 }]);
    }
    tests.push(['+50 Intelligence', { Stat: 'Int', Mode: 'Flat', Tags: [], Value: 50 }]);
    return tests.map(([label, mod]) => {
      const r = calcSkill(GD, ch, skillId, Object.assign({}, o, { extra: (o.extra || []).concat([Object.assign({ src: 'What-if' }, mod)]) }));
      return { label, dps: r.totalDps, gain: r.totalDps / base - 1 };
    }).sort((a, b) => b.gain - a.gain);
  }

  // Readable text for a mod, using the game's own stat_text templates where possible.
  function modText(GD, m) {
    const { types, conds, gemScaled } = splitTags(m.tags);
    const keys = [m.stat + '.' + m.mode + (m.tags.length ? '+' + m.tags.join('+') : ''), m.stat + '.' + m.mode + (conds[0] ? '+' + conds[0] : ''), m.stat + '.' + m.mode + (gemScaled ? '+GemScaled' : ''), m.stat + '.' + m.mode + '+', m.stat + '.' + m.mode];
    let t = null; for (const k of keys) if (GD.statText[k]) { t = GD.statText[k]; break; }
    const fmt = x => (Math.round(x * 100) / 100).toString();
    if (!t) return m.stat + ' ' + m.mode + ' ' + fmt(m.v) + (m.v2 ? '-' + fmt(m.v2) : '') + (m.tags.length ? ' [' + m.tags.join(', ') + ']' : '');
    const tagWords = [...types.filter((x, i, a) => a.indexOf(x) === i), ...conds].join(' ');
    return t.replace('{v}', fmt(m.v)).replace('{v2}', fmt(m.v2)).replace('{abs}', fmt(Math.abs(m.v))).replace('{tags}', tagWords || '').replace('{skills}', (conds.join(' ') || 'Skills'))
      .replace('{tag0}', m.tags[0] || '').replace('{tag1}', m.tags[1] || '').replace(/\{n\}\|plural\(one=([^,]+),other=([^)]+)\)/, (_, a, b) => Math.abs(m.v) === 1 ? a : b).replace(/\s+/g, ' ').trim()
      + (conds.length && !/\{tags\}|\{skills\}/.test(t) && !t.includes(conds[0]) ? ' (' + conds.join(', ') + ')' : '');
  }

  // ---------- support search ----------
  // Supports that add nothing against one enemy (packs, sustain, on-kill, triggers).
  const NO_SINGLE_TARGET = new Set(['chain', 'pierce', 'fork', 'tether', 'increased_area', 'life_leech', 'siphon', 'tithe', 'gather_fury',
    'bloodlust_support', 'bloodbound', 'war_banner_support', 'cast_on_crit', 'cast_when_hit', 'shatter', 'contagion_flame',
    'woebringer', 'pass_sentence', 'swift_step', 'bone_guard', 'ravening_host', 'minion_damage', 'minion_life',
    'minion_speed', 'channel_conduit', 'channel_mastery', 'woe_bearer', 'cast_on_minion_death',
    // New 5 Nov: Funeral Pyre bursts only on kills; Volatile Dead's blasts come when minions die (not modelled).
    'funeral_pyre', 'volatile_dead']);
  // Supports that only help mana: searched when the search must keep mana sustained.
  const MANA_ONLY = new Set(['siphon', 'tithe']);
  // On a summon gem only these lines change the minions' damage (minionSheet); other supports add nothing there.
  // Only supports made for minions (their socket rule names Minion) reach the minions' hits; a spell support on a
  // summon gem (Controlled Destruction, Spell Echo) changes the summoning spell, not what the minions deal.
  const forMinions = sp => !!sp && (sp.RequiresAnyTag || []).includes('Minion');
  // Melee Physical Damage works on melee minions only. Game tooltip (owner's screenshot, 9 Nov 2026): "Fits Hammer Blow, Holy Slash,
  // Summon Skeletons, Grave Golem, Raise Zombie, Holy Elemental, Moonfall, Thunderfall. Won't fit: ... The minions of Summon Skeletal Mage
  // cannot use it" (the shooting mage is left out). Multistrike and Brutality do fit it (see the notes above).
  const meleeOnlyMiss = (sp, sk) => !!sp && lc(sp.Id) === 'melee_physical' && !!sk && isSummon(sk) && (sk.Tags || []).includes('Projectile');
  // Trap cannot go into a Brand (Storm / Rime / Venom Spark carry the Chain tag, so the tags alone let it in). Owner, 9 Nov 2026: the game's Trap
  // tooltip lists only Zap, Marrow Lance, Ember Bolt and Frost Nova for the character, with Venom Spark not among them, and the owner confirms it cannot be socketed.
  const brandTrapMiss = (sp, sk) => !!sp && lc(sp.Id) === 'trap_support' && !!sk && sk.Delivery === 'Brand';
  const noFit = (sp, sk) => meleeOnlyMiss(sp, sk) || brandTrapMiss(sp, sk);
  // Faster Casting is a Spell support (no Minion tag) but speeds up shooting minions (patch notes 7 Nov, 0.56.3).
  const castsForMinions = (sp, sk) => !!sp && lc(sp.Id) === 'faster_casting' && !!sk && isSummon(sk) && (sk.Tags || []).includes('Projectile');
  const minionCounts = (sp, sk) => castsForMinions(sp, sk) || forMinions(sp) && (sp.Mods || []).some(m => (m.Stat === 'Damage' && m.Mode === 'More') || m.Stat === 'DamageAsExtra' || m.Stat === 'MinionStrikes' || m.Stat === 'RuthlessBlow' || ((m.Stat === 'MinionSpeed' || m.Stat === 'AttackSpeed') && m.Mode === 'More'));
  const SHAPES = ['orbit', 'skyfall', 'rain_support', 'trap_support', 'totem_support'];

  // Support gems the character has: spares + every support socketed in any skill.
  function ownedSupports(ch) {
    const s = new Set((ch.supportGems || []).map(lc));
    for (const so of ch.sockets) for (const id of so.supports) s.add(lc(id));
    return s;
  }
  function socketsFor(GD, ch, skillId, gemLevel) {
    let lv = gemLevel || ch.gemLevels[skillId] || 1;
    // Sockets open at the level the skill plays at, gear and passives included (owner's screenshot, 9 Nov 2026: Summon Skeletons
    // gem 16/20, "Plays at level 21 (+5 from gear and passives)", 6 supports socketed). Also explains the Rending Slam note below.
    try {
      const c = calcSkill(GD, ch, skillId, gemLevel ? { gemLevel } : {});
      if (c && c.gem && c.gem.total > lv) lv = c.gem.total;
    } catch (e) { /* keep the gem's own level */ }
    const byLevel = (GD.scaling.Gem.SocketsAtLevel || [1, 2, 5, 12, 15, 20]).filter(l => lv >= l).length;
    // A save keeps the supports it holds: the game's tooltip (owner's screenshot, 7 Nov 2026) shows Rending Slam at gem level 14/20
    // with all 5 supports active (DPS 325,907 counts Concentrated, Brutality, Rend, Afterimage, Melee Physical), though level 14 opens 4
    // sockets (log: "rending_slam opens support socket 4 (gem level 12)"). The save's helm had +1 skill level until it was swapped out.
    // So with no level override the saved count is the floor.
    if (gemLevel) return byLevel;
    const sock = (ch.sockets || []).find(s => lc(s.skill) === lc(skillId));
    return Math.max(byLevel, sock ? sock.supports.length : 0);
  }
  // Put the shape first (only the first shape socketed counts; Skyfall may follow as damage only).
  function arrangeShapes(set) {
    const shapes = set.filter(id => SHAPES.includes(id));
    const real = shapes.filter(id => id !== 'skyfall');
    if (real.length > 1) return null;
    const first = real[0] || (shapes.includes('skyfall') ? 'skyfall' : null);
    return first ? [first, ...set.filter(id => id !== first)] : set;
  }

  // The tags that decide which supports fit a skill's sockets. Thousand Cuts (Mirage hops) counts as a Movement
  // skill though its Tags leave it out: the game's Swift Step tooltip lists it under "Fits" and socketing it took
  // the panel from 35,774 to 42,929 DPS (screenshots, 2026-11-04). Same rule as makeCtx.
  function socketTags(sk) {
    const tags = new Set([...(sk.Tags || []), sk.Delivery].filter(Boolean).map(lc));
    if (sk.Mirage && sk.Mirage.Hops > 0) tags.add('movement');
    return tags;
  }

  // Every support that can go in this skill's sockets (or, for a Conduit spell, the channel's), for the page's picker.
  // packOnly: adds nothing against one enemy; shape: only one shape gem counts (Orbit, Skyfall, Rain, Trap, Totem).
  function supportChoices(GD, ch, skillId, o) {
    const sk = GD.skills[lc(skillId)]; if (!sk) return [];
    const host = conduitHost(GD, ch, skillId, collectMods(GD, ch, o || {}).mods, (o || {}).conduit);
    const base = host ? GD.skills[lc(host.skill)] || sk : sk;
    const tags = socketTags(base);
    const fits = sp => (!(sp.RequiresAnyTag || []).length || sp.RequiresAnyTag.some(t => tags.has(lc(t)))) && !(sp.ExcludeTags || []).some(t => tags.has(lc(t))) && !noFit(sp, base);
    return Object.values(GD.supports).filter(fits).map(sp => ({ id: lc(sp.Id), name: sp.Name, desc: sp.Description || '', packOnly: isSummon(sk) ? !minionCounts(sp, sk) : NO_SINGLE_TARGET.has(lc(sp.Id)) && !['cast_on_crit', 'channel_conduit', 'tithe', 'siphon'].includes(lc(sp.Id)), shape: SHAPES.includes(lc(sp.Id)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Tries every combination. Returns a job: call job.step(n) until job.done; job.results is sorted best first.
  // opt: { pool: 'owned' | 'all', target: 'enemy' | 'panel', sockets, keep: 15, manaOk: only setups whose mana is sustained,
  //        pinned: support ids that stay in every setup, blocked: support ids the search never picks (the page's "block" button) }
  function supportSearch(GD, ch, skillId, o, opt) {
    opt = opt || {};
    const sk = GD.skills[lc(skillId)];
    const host = conduitHost(GD, ch, skillId, collectMods(GD, ch, o).mods, o.conduit);
    const tagSets = [socketTags(sk)];
    if (host) tagSets.push(socketTags(GD.skills[lc(host.skill)]));
    const fitsTags = (s, tags) => (!(s.RequiresAnyTag || []).length || s.RequiresAnyTag.some(t => tags.has(lc(t)))) && !(s.ExcludeTags || []).some(t => tags.has(lc(t))) && !noFit(s, host ? GD.skills[lc(host.skill)] : sk);
    const owned = ownedSupports(ch);
    // A Conduit spell's supports sit in the channel's sockets, so they must fit the channel.
    const fits = Object.values(GD.supports).filter(s => host ? fitsTags(s, tagSets[1]) : fitsTags(s, tagSets[0]));
    // Pinned supports sit in every setup; the search fills the other sockets.
    const blocked = new Set((opt.blocked || []).map(lc));
    let pinned = (opt.pinned || []).map(lc).filter(id => !blocked.has(id) && fits.some(s => lc(s.Id) === id));
    const pinnedShapes = pinned.filter(id => SHAPES.includes(id) && id !== 'skyfall');
    if (pinnedShapes.length > 1) pinned = pinned.filter(id => !pinnedShapes.slice(1).includes(id));
    const pool = fits.filter(s => !isSummon(sk) || minionCounts(s, sk)).map(s => lc(s.Id)).filter(id => !pinned.includes(id) && !blocked.has(id) && (isSummon(sk) || !NO_SINGLE_TARGET.has(id) || (opt.manaOk && MANA_ONLY.has(id))) && (opt.pool === 'all' || owned.has(id)));
    // A Conduit spell rides in the channel's sockets (the granted Conduit takes none).
    const sockets = opt.sockets || (host ? socketsFor(GD, ch, host.skill) : socketsFor(GD, ch, skillId, o.gemLevel));
    if (pinned.length > sockets) pinned = pinned.slice(0, sockets);
    const k = Math.min(Math.max(0, sockets - pinned.length), pool.length);
    const base = Object.assign({}, o); delete base.supportsOverride;
    base.off = new Set([...(o.off || [])].filter(x => !String(x).startsWith('support:')));
    base._col = collectMods(GD, ch, base);
    const score = sup => { const r = calcSkill(GD, ch, skillId, Object.assign({}, base, { supportsOverride: sup })); return { r, v: opt.target === 'panel' ? r.panelDps : r.totalDps }; };
    const combos = (() => { let t = 1; for (let i = 0; i < k; i++) t = t * (pool.length - i) / (i + 1); return Math.round(t); })();
    const keep = opt.keep || 15; const results = [];
    let tried = 0;
    // Scores one setup (free picks + pinned), keeps it in the results; -1 when it can't be used.
    const seen = new Map();
    const evalSet = picks => {
      const key = picks.slice().sort().join('|');
      if (seen.has(key)) return seen.get(key);
      let v = -1;
      const sup = arrangeShapes([...pinned, ...picks]);
      tried++;
      if (sup) {
        const sc = score(sup), r = sc.r;
        if (opt.manaOk && r.mana && !r.mana.skip && !r.mana.ok) { job.manaDropped = (job.manaDropped || 0) + 1; }
        else {
          v = sc.v;
          if (results.length < keep || v > results[results.length - 1].v) {
            results.push({ sup, v, total: r.totalDps, panel: r.panelDps, manaPerSec: r.mana && !r.mana.skip ? r.mana.spend : null, manaGain: r.mana && !r.mana.skip ? r.mana.gain : null, mana: sup.reduce((p, id) => p * ((GD.supports[id] || {}).ManaMultiplier || 1), 1), notOwned: sup.filter(id => !owned.has(id)) });
            results.sort((a, b) => b.v - a.v); if (results.length > keep) results.pop();
          }
        }
      }
      seen.set(key, v);
      return v;
    };
    // Up to EXACT_MAX setups: try them all. More than that (6 sockets and 27 supports is 296,010 setups,
    // about 3 minutes): fill the sockets one best support at a time, then swap one or two supports while that
    // helps. Checked against trying them all on 2026-11-04: same best setup for Judgement (Shrimspins,
    // 3,025,333 in 3,402 setups instead of 296,010) and Cyclone; the swaps of two find pairs that only help
    // together (Stormfrost + Living Storm, 0% each on their own).
    const EXACT_MAX = 5000;
    const exact = combos <= EXACT_MAX;
    function* everySetup() {
      if (k === 0) { evalSet([]); return; } // only the pinned setup
      const idx = Array.from({ length: k }, (_, i) => i);
      for (;;) {
        evalSet(idx.map(i => pool[i])); yield;
        let i = k - 1; while (i >= 0 && idx[i] === pool.length - k + i) i--;
        if (i < 0) return;
        idx[i]++; for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
      }
    }
    function* climb() {
      let cur = [];
      for (let s = 0; s < k; s++) {
        let best = null, bv = -Infinity;
        for (const p of pool) if (!cur.includes(p)) { const v = evalSet([...cur, p]); yield; if (v > bv) { bv = v; best = p; } }
        cur.push(best);
      }
      let v = evalSet(cur);
      const better = nv => nv > v * 1.000001 && nv > 0;
      for (let moved = true; moved;) {
        moved = false;
        for (let i = 0; i < k && !moved; i++) for (const p of pool) {
          if (cur.includes(p)) continue;
          const n = cur.slice(); n[i] = p; const nv = evalSet(n); yield;
          if (better(nv)) { cur = n; v = nv; moved = true; break; }
        }
        if (moved) continue;
        const out = pool.filter(p => !cur.includes(p));
        swap2: for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) for (let a = 0; a < out.length; a++) for (let b = a + 1; b < out.length; b++) {
          const n = cur.slice(); n[i] = out[a]; n[j] = out[b]; const nv = evalSet(n); yield;
          if (better(nv)) { cur = n; v = nv; moved = true; break swap2; }
        }
      }
    }
    // Progress for the climb: a guess (fill + one pass of single and double swaps), raised as it runs.
    const guess = exact ? combos : k * pool.length + k * (pool.length - k) + k * (k - 1) / 2 * (pool.length - k) * (pool.length - k - 1) / 2;
    const gen = exact ? everySetup() : climb();
    let more = k > 0 || pinned.length > 0;
    const job = {
      pool, sockets: k + pinned.length, pinned, combos, exact, owned, results, done: !more,
      get tried() { return tried; },
      get total() { return job.done ? tried : Math.max(Math.round(guess), Math.ceil(tried * 1.1)); },
      step(n) {
        while (n-- > 0 && more) if (gen.next().done) more = false;
        job.done = !more; return job;
      },
    };
    return job;
  }

  // Is this stat part of the DPS math (or deliberately non-damage)? Used to flag lines the sheet cannot count.
  const counted = stat => HANDLED.has(stat) || NON_DAMAGE.has(stat);
  // Passive points the character has not spent: PassivePointsPerLevel for each level after the first plus
  // the save's bonus points (Shrimspins L74: 73 + 13 = 86 points, 85 taken). Null when unknown (build codes).
  function freePoints(GD, ch) {
    if (ch.bonusPoints == null) return null;
    const per = (GD.scaling.Hero || {}).PassivePointsPerLevel || 1;
    return Math.max(0, Math.round((ch.level - 1) * per + ch.bonusPoints - (ch.passives || []).filter(id => !/^start_/.test(id)).length));
  }
  // Display helper for the Skill Scaling tab (no change to the model): the level multiplier the sheet uses for a gem
  // at own level + bonus gear levels. attack: levelFactor (effectiveness not included); spell: spellGrowth.
  function gemLevelGrowth(GD, kind, own, bonus) {
    const G = GD.scaling.Gem;
    if (kind === 'attack') { const [fullB, fadedB] = bonusSplit(bonus); return (1 + (G.AttackEffectivenessPerLevel || 0) * (own - 1)) * (G.BonusLevelAttackMore > 0 ? Math.pow(G.BonusLevelAttackMore, fullB) : 1 + (G.AttackEffectivenessPerLevel || 0) * fullB) * Math.pow(BONUS_FADE_ATTACK, fadedB); }
    return spellLevelGrowth(G.DamageGrowth || 1.19, own, bonus, spellFade(GD));
  }
  const api = { heroMaxLife, gemLevelGrowth, vowShare,cocSource, cocAttacks, freePoints, wardAt, guardianVariantResist, counted, damageStat: stat => HANDLED.has(stat) && !['Str', 'Dex', 'Int', 'Attributes'].includes(stat), extractCharacter, characterFromCode, conduitHost, conduitInterval, collectMods, calcSkill, listSkills, weaponStats: (GD, item, base, mods) => weaponStats(GD, item, base, mods, () => {}), statWeights, modText, splitTags, DT, supportSearch, supportChoices, ownedSupports, socketsFor, arrangeShapes, NO_SINGLE_TARGET };
  root.BOSim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
