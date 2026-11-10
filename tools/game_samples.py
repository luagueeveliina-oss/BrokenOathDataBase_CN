import json, os, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ROOT = r'D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data'
out=[]
def w(x): out.append(str(x))
def dump(rel, key=None, n=3, indent=1):
    j=json.load(open(os.path.join(ROOT,rel),encoding='utf-8'))
    arr=j[key] if key else j
    w('\n########## '+rel+'  (key='+str(key)+') ##########')
    w(json.dumps(j, ensure_ascii=False)[:0])
    for e in arr[:n]:
        w(json.dumps(e, ensure_ascii=False, indent=indent)[:2500])
        w('-'*30)

dump(r'Items\item_bases.json','bases',4)
dump(r'Items\uniques.json','uniques',4)
dump(r'Items\affixes.json','affixes',2)
dump(r'Items\runes.json','runes',3)
dump(r'Items\runewords.json','runewords',3)
dump(r'Items\stat_text.json','texts',6)
dump(r'Gameplay\skills.json','skills',3)
dump(r'Gameplay\supports.json','supports',3)
dump(r'Gameplay\blessings.json','blessings',2)
dump(r'Gameplay\curses.json','curses',2)
dump(r'Items\cube_recipes.json','recipes',3)
dump(r'Gameplay\forge.json','Recipes',3)
dump(r'Gameplay\potions.json','Vessels',2)
dump(r'Gameplay\classes.json','classes',2)
w('\n########## potions full ##########')
j=json.load(open(os.path.join(ROOT,'Gameplay','potions.json'),encoding='utf-8'))
w(json.dumps({k:v for k,v in j.items() if k!='Sprites'}, ensure_ascii=False)[:6000])
open('tools/game_samples.txt','w',encoding='utf-8').write('\n'.join(out))
print('ok')
