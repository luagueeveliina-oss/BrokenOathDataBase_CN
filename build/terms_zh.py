# -*- coding: utf-8 -*-
"""Glossary used while rendering game data into Chinese."""

# tags that describe what an item / mod applies to, or a skill family
TAGS = {
    # damage / elements
    "Physical": "物理", "Fire": "火焰", "Cold": "冰霜", "Lightning": "闪电", "Poison": "毒素",
    "Holy": "神圣", "Elemental": "元素", "Chaos": "混沌",
    # skill families
    "Attack": "攻击", "Spell": "法术", "Melee": "近战", "Projectile": "投射物", "Area": "区域",
    "Slam": "重击", "Nova": "新星", "Chain": "连锁", "Rain": "箭雨", "Orbit": "环绕", "Brand": "印记",
    "Totem": "图腾", "Trap": "陷阱", "Dash": "冲刺", "Leap": "跃击", "Blink": "闪现", "Beam": "射线",
    "Whirl": "旋舞", "Channelling": "引导", "Duration": "持续", "Aura": "光环", "Minion": "召唤物",
    "Curse": "诅咒", "Vow": "誓约", "Herald": "先驱", "Woe": "灾祸", "Sentence": "判决", "Cry": "战吼",
    "Banner": "战旗", "Skyfall": "天降", "Strike": "打击", "Pulse": "脉冲", "Roll": "翻滚",
    "Raise": "召唤", "Corpse": "尸体", "Gem": "宝石", "Movement": "移动", "Holy2": "神圣",
    "Hit": "击中", "Kill": "击杀", "SkillUse": "技能使用", "Eruption": "喷发", "DawnPillar": "曙光柱",
    "SkySwords": "天剑", "Firewall": "火墙", "StormWolf": "风暴之狼", "Spark": "电火花",
    "Whirlwind": "旋风", "Tether": "牵索", "BothHands": "双武器", "FirstTarget": "首个目标",
    "Conduit": "导管", "Pulse2": "脉冲",
    # weapon / armour classes
    "Weapon": "武器", "Ranged": "远程", "TwoHand": "双手", "OneHand": "单手", "Bow": "弓",
    "Greatsword": "巨剑", "OneHandSword": "单手剑", "OneHandAxe": "单手斧", "OneHandMace": "单手锤",
    "TwoHandSword": "双手剑", "TwoHandAxe": "双手斧", "TwoHandMace": "双手锤", "Staff": "法杖",
    "Wand": "魔杖", "Scythe": "镰刀", "Dagger": "匕首", "Claw": "利爪", "Fist": "拳套",
    "DualBlades": "双刃", "MaceShield": "锤盾", "Shield": "盾牌", "Quiver": "箭袋", "Tome": "魔典",
    "Idol": "神像", "Idol1": "一级神像", "Idol2": "二级神像", "Idol3": "三级神像", "Idol4": "四级神像",
    "IdolGrand": "宏伟神像", "DwarvenRune": "矮人符文", "Caster": "施法者", "Martial": "拳爪",
    "Unarmed": "空手", "DualWielding": "双持", "HoldingShield": "持盾", "Jewellery": "珠宝",
    # equipment slots
    "Helm": "头盔", "Chest": "胸甲", "Gloves": "手套", "Boots": "靴子", "Belt": "腰带",
    "Amulet": "项链", "Ring": "戒指", "MainHand": "主手", "OffHand": "副手",
    # misc flags
    "Defences": "防御", "Armour": "护甲", "Evasion": "闪避", "EnergyShield": "能量护盾",
    "CoreTouched": "核心侵蚀", "GnomeMade": "侏儒造物", "Mythic85": "神话", "GemScaled": "随宝石等级",
    "ElementalOverload": "元素超载", "BloodMagic": "血魔法", "ChainNoFalloff": "连锁无衰减",
    "ArmourVsElemental": "护甲抗元素", "Spellblade": "法术之刃", "HollowCovenant": "虚空契约",
    "PyreHallows": "薪火圣殿", "VsBurning": "对燃烧", "VsShocked": "对感电", "VsBurningOrShocked": "对燃烧或感电",
    "VsBoss": "对首领", "NoEvasion": "无法闪避", "NoLeech": "无法吸取", "NoHeroDamage": "无英雄伤害",
    "NoElemental": "无元素", "UnarmedMelee": "空手近战", "TotemNoExpire": "图腾不消失",
    "CurseOnHit": "击中诅咒", "VowNoForsworn": "誓约不受背誓", "BothHands2": "双武器",
    "WhenHit": "受击时", "Reraise": "再起",
}

SLOTS = {
    "MainHand": "主手", "OffHand": "副手", "Helm": "头盔", "Chest": "胸甲", "Gloves": "手套",
    "Boots": "靴子", "Belt": "腰带", "Amulet": "项链", "Ring": "戒指", "Idol": "神像",
    "DwarvenRune": "矮人符文", "Quiver": "箭袋", "Shield": "盾牌", "Tome": "魔典",
}

CLASSES = {
    "Warrior": "战士", "Mage": "法师", "Ranger": "游侠", "Necromancer": "死灵法师",
    "Paladin": "圣骑士", "Samurai": "武士",
}

ITEM_CLASSES = {
    "Bow": "弓", "DualBlades": "双刃", "Greatsword": "巨剑", "MaceShield": "锤盾", "Scythe": "镰刀",
    "Staff": "法杖", "Chest": "胸甲", "Helm": "头盔", "Gloves": "手套", "Boots": "靴子",
    "Ring": "戒指", "Amulet": "项链", "Belt": "腰带", "Quiver": "箭袋", "OneHandSword": "单手剑",
    "OneHandAxe": "单手斧", "OneHandMace": "单手锤", "Dagger": "匕首", "Claw": "利爪", "Fist": "拳套",
    "Wand": "魔杖", "Shield": "盾牌", "Tome": "魔典", "Idol": "神像", "DwarvenRune": "矮人符文",
}

DELIVERY = {
    "Spin": "旋舞", "Blink": "闪现", "Orb": "宝珠", "Brand": "印记", "Melee": "近战",
    "Projectile": "投射物", "Summon": "召唤", "Beam": "射线", "Aura": "光环", "CorpseBurst": "尸爆",
    "Skyfall": "天降", "Orbit": "环绕", "Empower": "强化", "Ground": "地面", "Charge": "冲锋",
    "Slam": "重击", "Rain": "箭雨", "Dash": "冲刺", "Totem": "图腾", "Sheathe": "收刀",
    "Leap": "跃击", "Vow": "誓约", "Woe": "灾祸", "Toll": "丧钟", "Sentence": "判决",
    "Cry": "战吼", "Banner": "战旗",
}

SKILL_KIND = {"Gem": "技能宝石", "Basic": "基础攻击", "Weapon": "武器技能"}

ATTRIBUTE = {"Str": "力量", "Dex": "敏捷", "Int": "智力"}

AFFIX_TYPE = {"Prefix": "前缀", "Suffix": "后缀", "Mythic": "神话"}

POTION_ROLE = {"Life": "生命", "Mana": "魔力", "Utility": "功能"}

TREE_KIND = {
    "Small": "小节点", "Notable": "显著节点", "Attribute": "属性节点", "Keystone": "基石",
    "Choice": "抉择", "Socket": "插槽", "Start": "起始点",
}

RARITY = {"Normal": "普通", "Magic": "魔法", "Rare": "稀有", "Unique": "传奇", "Guardian": "守护者"}

FORGE_KIND = {
    "AddAffix": "添加词缀", "RemoveCrafted": "移除工艺", "Reroll": "重铸", "Upgrade": "升级",
    "Hone": "打磨品质", "UpgradeMod": "提升词缀", "Temper": "淬炼工艺",
    "RerollValues": "重掷数值", "Imbue": "点化", "Reforge": "重铸",
    "Ascend": "升华", "KeepPrefixes": "锁定前缀", "KeepSuffixes": "锁定后缀",
    "RerollUnique": "重掷传奇", "RerollMod": "重掷单词缀", "ReplaceMod": "替换词缀",
    "RerollTiers": "重掷阶级", "RemoveMod": "移除词缀",
    "EchoAdd": "回声·添加", "EchoUpgrade": "回声·提升", "EchoReroll": "回声·重掷", "EchoRemove": "回声·移除",
    "AddSocket": "开孔",
}

FORGE_GROUP = {"Add": "添加词缀", "Reforge": "重铸", "Slots": "孔位与品质", "Mastery": "精通"}

CUBE_FAMILY = {"Items": "物品", "Reds": "红色阶级", "Runes": "符文", "Jewels": "珠宝"}

# words used inside {skills} / {tags} placeholders
def tag_phrase(tag, lang="zh"):
    if lang == "zh":
        return TAGS.get(tag, tag)
    return tag
