/* ============================================
   diseases.js - 疾病基础数据（用于游戏逻辑）
   科普教育数据见 education.js
   ============================================ */

const DISEASES = {
    HIV: {
        key: "HIV",
        name: "艾滋病 (HIV)",
        riskType: "fluid",
        desc: "免疫崩溃，不可逆转。",
        transmission: "体液传播"
    },
    SYPHILIS: {
        key: "SYPHILIS",
        name: "梅毒",
        riskType: "contact",
        desc: "全身红斑，侵蚀神经。",
        transmission: "接触传播"
    },
    HERPES: {
        key: "HERPES",
        name: "生殖器疱疹",
        riskType: "skin",
        desc: "终身携带，反复剧痛。",
        transmission: "皮肤接触"
    },
    HPV: {
        key: "HPV",
        name: "尖锐湿疣",
        riskType: "contact",
        desc: "菜花突起，极难根治。",
        transmission: "接触传播"
    },
    GONORRHEA: {
        key: "GONORRHEA",
        name: "淋病",
        riskType: "fluid_mucous",
        desc: "流脓刺痛。",
        transmission: "体液粘膜"
    },
    CRABS: {
        key: "CRABS",
        name: "阴虱",
        riskType: "skin_hair",
        desc: "剧烈瘙痒。",
        transmission: "密切接触"
    }
};
