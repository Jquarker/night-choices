/* ============================================
   config.js - 游戏数值常量
   所有概率参数集中管理，便于调整
   全部概率保持最多两位小数
   ============================================ */

const CONFIG = {
    // ---- 核心游戏参数 ----
    // 初始生理压抑值 [min, max]，每局随机
    startFrustration: { min: 50, max: 90 },

    // 每回合被动压抑增长 [min, max]
    passiveGain:       { min: 5, max: 8 },
    anxietyGainPassive:{ min: 1, max: 3 },     // 高压力时额外被动增加

    // 非性行为压抑变化 [min, max]
    chatCost:          { min: 2, max: 5 },     // 聊天消耗
    refuseCost:        { min: -10, max: 6 },     // 拒绝额外消耗
    hospitalCost:      { min: 10, max: 18 },   // 去医院压抑增长

    // 各行为：压抑降低 reward [min, max]
    // 区分度：oral_condom < sex_condom < oral_raw < sex_raw
    // 相邻档位允许小幅重叠，但首尾绝不重叠
    rewards: {
        oral_condom: { min: 6,  max: 10 },    // 最低收益，最安全
        sex_condom:  { min: 11, max: 17 },    // 中低收益
        oral_raw:    { min: 12, max: 18 },    // 中高收益
        sex_raw:     { min: 18, max: 28 }     // 最高收益，最高风险
    },

    // 各行为：心理压力增加 [min, max]
    // 区分度：oral_condom < sex_condom << oral_raw < sex_raw
    stress: {
        oral_condom: { min: 1,  max: 4  },    // 几乎无压力
        sex_condom:  { min: 3,  max: 12  },    // 轻微压力
        oral_raw:    { min: 10, max: 20 },    // 明显压力
        sex_raw:     { min: 15, max: 30 }     // 严重压力
    },

    // ---- 体征缩放焦虑 ----
    // 伴侣身上每多一个可见高危体征（红色/紫色标签），压力额外增加
    ANXIETY_SIGN: {
        perSignMultiplier: 0.50,  // 每个可见体征增加 50% 基础压力
        maxMultiplier:     2.00   // 压力倍率上限（最多×2）
    },

    // ---- 流行病学参数 ----
    // 游戏帮助中已标注"为教育目的已放大风险"

    // 伴侣携带至少一种性传播疾病的概率
    carrierRate: 0.22,

    // 基准单次暴露传染率（无保护行为，全部 ≤ 两位小数）
    TRANSMISSION_RATES: {
        sex_raw: {
            HIV: 0.06,
            GONORRHEA: 0.70,
            SYPHILIS: 0.80,
            HPV: 0.48,
            HERPES: 0.65,
            CRABS: 0.16
        },
        oral_raw: {
            HIV: 0.01,          // 口交风险显著低于阴交
            GONORRHEA: 0.10,    // 咽部淋病
            SYPHILIS: 0.06,     // 口腔下疳
            HPV: 0.06,
            HERPES: 0.20,       // HSV-1→生殖器（口交风险较高）
            CRABS: 0.03
        }
    },

    // 安全套保护系数（乘数，越小 = 保护越好，全部 ≤ 两位小数）
    CONDOM_EFFECT: {
        fluid: 0.15,            // 体液类：约 85% 防护
        fluid_mucous: 0.15,
        contact: 0.30,          // 接触类：约 70% 防护
        skin: 0.60,             // 皮肤类：约 40% 防护
        skin_hair: 0.60
    },

    // 安全套破损/滑脱概率
    CONDOM_FAILURE_RATE: 0.04,

    // 口交戴套额外乘数
    ORAL_CONDOM_EXTRA_MULT: 1.00,

    // ---- 累积暴露模型 ----
    CUMULATIVE: {
        enabled: true,
        multiplier: 1.20,       // 每次同病暴露后风险 ×1.2
        cap: 0.95               // 累积上限 95%
    },

    // ---- 试纸获取概率 ----
    TESTKIT_CHANCE: {
        sex_condom: 0.15,
        oral_condom: 0.10
    },

    // ---- 试纸准确性 ----
    // 现实中快速试纸存在窗口期、操作误差等导致的误判
    TESTKIT_ACCURACY: {
        falseNegativeRate: 0.05,  // 假阴性：有病但显示阴性（窗口期/操作不当）
        falsePositiveRate: 0.03   // 假阳性：无病但显示阳性（交叉反应/污染）
    }
};

/**
 * 从 CONFIG 的 {min, max} 范围中随机取一个值
 * @param {{min: number, max: number}} range
 * @returns {number} 范围内的随机值
 */
function roll(range) {
    if (!range || typeof range !== 'object') return range || 0;
    return Math.round(range.min + Math.random() * (range.max - range.min));
}
