/* ============================================
   state.js - 游戏状态管理
   ============================================ */

let STATE = {
    frustration: 70,         // 生理压抑值 0-100（初始随机 50~90）
    anxiety: 0,              // 心理压力值 0-100
    turn: 1,                 // 当前回合
    items: { testkit: 1 },   // 试纸初始为1，需通过医院或安全行为获取
    currentPartner: null,    // 当前伴侣对象
    isInfected: false,       // 是否已被感染
    infectionData: null,     // 感染的具体疾病数据
    isGameOver: false,       // 游戏是否已结束
    history: [],             // 约会历史记录
    exposureCounts: {}       // 各病原体暴露次数 { HIV: 2, SYPHILIS: 1, ... }
};

/** 重置游戏状态到初始值 */
function resetState() {
    STATE.frustration = roll(CONFIG.startFrustration);
    STATE.anxiety = 0;
    STATE.turn = 1;
    STATE.items = { testkit: 1 };
    STATE.isGameOver = false;
    STATE.isInfected = false;
    STATE.infectionData = null;
    STATE.history = [];
    STATE.exposureCounts = {};
}
