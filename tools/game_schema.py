import json, os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'

files = [
 r'Items\item_bases.json', r'Items\uniques.json', r'Items\affixes.json', r'Items\runes.json',
 r'Items\runewords.json', r'Items\stat_text.json', r'Items\cube_recipes.json',
 r'Items\quality_stones.json', r'Items\mythic_lines.json', r'Items\oath_hints.json',
 r'Gameplay\skills.json', r'Gameplay\supports.json', r'Gameplay\potions.json',
 r'Gameplay\classes.json', r'Gameplay\blessings.json', r'Gameplay\curses.json',
 r'Gameplay\forge.json', r'Gameplay\scaling.json', r'Gameplay\gem_homes.json',
 r'Gameplay\passive_tree.json', r'Gameplay\monsters.json', r'Gameplay\monster_affixes.json',
 r'Gameplay\weapons.json', r'Gameplay\weapon_styles.json', r'Gameplay\achievements.json',
 r'Gameplay\guides.json', r'Gameplay\unlocks.json', r'Gameplay\progression.json',
 r'Rifts\bosses.json', r'Rifts\sigils.json', r'Rifts\boons.json', r'Rifts\boss_mechanics.json',
 r'Zones\zones.json', r'Gameplay\league_rules.json', r'Gameplay\death_hints.json',
]

def desc(o, depth=0, key='root', maxdepth=2):
    pad='  '*depth
    if isinstance(o, dict):
        keys=list(o.keys())
        print(f'{pad}{key}: dict[{len(keys)}] {keys[:12]}')
        if depth<maxdepth:
            for k in keys[:6]:
                desc(o[k], depth+1, k, maxdepth)
    elif isinstance(o, list):
        print(f'{pad}{key}: list[{len(o)}]')
        if o and depth<maxdepth:
            desc(o[0], depth+1, key+'[0]', maxdepth)
    else:
        print(f'{pad}{key}: {type(o).__name__} {repr(o)[:100]}')

for f in files:
    p=os.path.join(ROOT,f)
    if not os.path.exists(p):
        print('MISSING', f); continue
    try:
        j=json.load(open(p,encoding='utf-8'))
    except Exception as e:
        print('ERR', f, e); continue
    print('\n' + '='*70)
    print(f, os.path.getsize(p), 'bytes')
    desc(j)
