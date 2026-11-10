# Broken Oath 中文资料库 — 翻译术语表（唯一事实来源）

## 目标读者与语气
- 读者：中文 ARPG 玩家（玩过《流放之路》《暗黑破坏神》《最后纪元》等"刷子游戏"）。
- 语气：简洁、硬朗、有暗黑奇幻感；描述机制时准确，不要文学化过头。
- 数值、括号、标点必须与原文一一对应；**不要增删任何数字**。

## 一、职业 / 属性 / 槽位
| EN | 中文 |
|---|---|
| Warrior / Mage / Ranger / Necromancer / Paladin / Samurai | 战士 / 法师 / 游侠 / 死灵法师 / 圣骑士 / 武士 |
| Strength (Str) / Dexterity (Dex) / Intelligence (Int) | 力量 / 敏捷 / 智力 |
| MainHand / OffHand | 主手 / 副手 |
| Helm / Chest / Gloves / Boots / Belt | 头盔 / 胸甲 / 手套 / 靴子 / 腰带 |
| Amulet / Ring / Quiver / Shield / Tome / Idol | 项链 / 戒指 / 箭袋 / 盾牌 / 魔典 / 神像 |
| Magic / Rare / Unique / Normal / Guardian | 魔法 / 稀有 / 传奇 / 普通 / 守护者 |
| Prefix / Suffix / Affix | 前缀 / 后缀 / 词缀 |
| Base item / Unique / Runeword | 底材 / 传奇物品 / 符文之语 |
| Item Level (ilvl) / Rupture Level (RL) / Monster Level (ML) | 物品等级 / 裂隙等级 / 怪物等级 |

## 二、伤害 / 防御 / 资源
| EN | 中文 |
|---|---|
| Physical / Fire / Cold / Lightning / Poison / Holy / Elemental | 物理 / 火焰 / 冰霜 / 闪电 / 毒素 / 神圣 / 元素 |
| Damage / Attack / Spell / Melee / Projectile | 伤害 / 攻击 / 法术 / 近战 / 投射物 |
| maximum Life / maximum Mana / Energy Shield / Armour / Evasion Rating | 最大生命 / 最大魔力 / 能量护盾 / 护甲 / 闪避值 |
| Defences / Resistance / Chance to Block | 防御值 / 抗性 / 格挡率 |
| Critical Strike Chance / Critical Strike Multiplier | 暴击率 / 暴击伤害加成 |
| Attack Speed / Cast Speed / Movement Speed | 攻击速度 / 施法速度 / 移动速度 |
| Area of Effect / Radius / Duration | 效果区域 / 半径 / 持续时间 |
| Cooldown / Mana Cost / Reservation | 冷却 / 魔力消耗 / 保留 |
| increased / reduced | 增加 / 降低（加算） |
| more / less | 更多 / 更少（乘算） |
| Adds X to Y Damage | 附加 X - Y 点伤害 |
| Gain X% of A Damage as Extra B Damage | 获得等同 A 伤害 X% 的额外 B 伤害 |
| Regenerate / Leech / on Hit / on Kill | 回复 / 吸取 / 击中时 / 击杀时 |
| Ignite / Burning / Shock / Chill / Freeze / Bleed / Poison / Maim / Stun | 点燃 / 燃烧 / 感电 / 冰缓 / 冻结 / 流血 / 中毒 / 致残 / 眩晕 |
| Ailment / Damage over Time (DoT) | 异常状态 / 持续伤害 |

## 三、技能类型（tag）
| EN | 中文 |
|---|---|
| Attack / Spell / Minion / Aura / Curse / Vow / Herald / Woe / Sentence | 攻击 / 法术 / 召唤物 / 光环 / 诅咒 / 誓约 / 先驱 / 灾祸 / 判决 |
| Slam / Nova / Chain / Projectile / Rain / Orbit / Brand / Totem / Trap / Dash / Leap / Blink / Beam / Whirl / Channel(Channelling) / Duration / Area / Strike | 重击 / 新星 / 连锁 / 投射物 / 箭雨 / 环绕 / 印记 / 图腾 / 陷阱 / 冲刺 / 跃击 / 闪现 / 射线 / 旋舞 / 引导 / 持续 / 区域 / 打击 |
| Support gem / Skill gem | 辅助宝石 / 技能宝石 |
| Channelling Skills | 引导技能 |
| Emberforged / Core / Oathstone / Rupture | 烬铸 / 核心 / 誓石 / 裂隙 |
| Forge / Cube (Oathstone Cube) / Oathmark | 锻造炉 / 誓石魔方 / 誓痕 |

## 四、写作规则
1. **英文专有名词保留原名并附中文**：物品名格式为「中文译名」，单独字段保存英文原名，不要在同一字符串里混排。
2. 变量占位符（`{v}`、`{v2}`、`{abs}`、`{tags}`、`{tag0}`、`{tag1}`、`{skills}`、`{0}`、`{1}`）必须原样保留，数量与顺序一致。
3. 描述性长句：拆成短句，用逗号/分号；避免"的的不休"；术语按上表。
4. 技能/物品名翻译要像游戏本地化：2-4 字为主，可意译，务必保持暗黑感（例：`Earthshatter`→碎地，`Wind Whispers`→风语，`Stormwhisper`→风语者）。
5. 专有地名/人名音译：Myrh Forest→米尔森林，Kabarian Swamp→卡巴瑞恩沼泽，El Anure→埃兰努尔，Harmoniya→哈莫尼亚，Massadia→马萨迪亚。
6. 输出必须是**合法 JSON 对象**，键与输入完全一致，不得增删键。
