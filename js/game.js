/* ============================================
   game.js - 核心游戏逻辑
   伴侣生成、行为处理、感染判定、胜负判定
   ============================================ */

// ==========================================
// 游戏初始化
// ==========================================

function initGame() {
    resetState();
    updateStatsUI();
    generateNewPartner();
}

// ==========================================
// 伴侣生成
// ==========================================

function generateNewPartner() {
    const numTags = Math.floor(Math.random() * 2) + 3;
    const partnerTags = [];
    const selectedIndices = new Set();
    const isCarrier = Math.random() < CONFIG.carrierRate;
    const hasConstraint = Math.random() < 0.4;

    let loopLimit = 0;
    while (partnerTags.length < numTags && loopLimit < 100) {
        loopLimit++;
        const idx = Math.floor(Math.random() * ALL_TAGS.length);
        if (selectedIndices.has(idx)) continue;
        const tagTemplate = ALL_TAGS[idx];
        if (isCarrier && partnerTags.length === 0 && !tagTemplate.color.includes('red') && !tagTemplate.color.includes('purple')) continue;
        if (hasConstraint && !partnerTags.some(t => t.constraint) && !tagTemplate.constraint && loopLimit < 50) continue;

        const currentConstraints = partnerTags.map(t => t.constraint).filter(Boolean);
        if (tagTemplate.constraint) {
            if (tagTemplate.constraint === 'no_oral' && currentConstraints.includes('oral_only')) continue;
            if (tagTemplate.constraint === 'oral_only' && currentConstraints.includes('no_oral')) continue;
        }
        selectedIndices.add(idx);
        let isHidden = false;
        const currentHiddenCount = partnerTags.filter(t => !t.revealed).length;
        if (currentHiddenCount === 0 && tagTemplate.hiddenChance > 0) isHidden = Math.random() < tagTemplate.hiddenChance;
        partnerTags.push({ ...tagTemplate, revealed: !isHidden });
    }
    if (partnerTags.every(t => !t.revealed)) partnerTags[0].revealed = true;

    let activeDiseases = [];
    if (Math.random() < 0.05) {
        const keys = Object.keys(DISEASES);
        activeDiseases.push(keys[Math.floor(Math.random() * keys.length)]);
    }
    partnerTags.forEach(tag => {
        if (tag.risk) {
            for (const [dKey, prob] of Object.entries(tag.risk)) {
                if (Math.random() < prob && !activeDiseases.includes(dKey)) activeDiseases.push(dKey);
            }
        }
        if (tag.safeChance && Math.random() < tag.safeChance) activeDiseases = [];
    });

    STATE.currentPartner = {
        tags: partnerTags,
        diseases: activeDiseases,
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
        testedNegative: false   // 是否已经试纸检测为阴性
    };

    renderPartner();
}

// ==========================================
// 回合推进与胜负判定
// ==========================================

function advanceTime(fCost, aCost = 0) {
    STATE.turn++;
    STATE.frustration += fCost;
    STATE.anxiety += aCost;
    if (STATE.anxiety > 20) STATE.anxiety += roll(CONFIG.anxietyGainPassive);
    if (STATE.frustration > 100) STATE.frustration = 100;
    if (STATE.anxiety > 100) STATE.anxiety = 100;
    updateStatsUI();

    if (STATE.frustration >= 100) {
        showGameOver("欲火焚身", "长期的压抑让你彻底失去了理智。你无法再思考后果，在绝望中发生了一次随机的高危行为。", "🤯");
        return true;
    }
    if (STATE.anxiety >= 100) {
        showGameOver("精神崩溃", "巨大的心理压力压垮了你。你开始出现幻觉，被送往了精神病院，游戏结束。", "😵‍💫");
        return true;
    }
    return false;
}

// ==========================================
// 传播概率计算（新模型）
// ==========================================

/**
 * 计算某次行为对特定疾病的感染概率
 * @param {string} actionType - 行为类型 (sex_raw, sex_condom, oral_raw, oral_condom)
 * @param {object} disease - DISEASES 中的疾病对象
 * @returns {number} 0-1 之间的感染概率
 */
function getTransmissionChance(actionType, disease, condomFailed = false) {
    // 确定基准行为 (raw)，然后根据是否戴套应用保护系数
    const baseAction = actionType.includes('oral') ? 'oral_raw' : 'sex_raw';
    const base = (CONFIG.TRANSMISSION_RATES[baseAction] && CONFIG.TRANSMISSION_RATES[baseAction][disease.key]) || 0;

    if (base === 0) return 0;

    let chance = base;

    // 戴套行为且未破损 → 应用保护系数
    if (actionType.includes('condom') && !condomFailed) {
        let condomMult;
        if (disease.riskType === 'skin_hair' || disease.riskType === 'skin') {
            condomMult = CONFIG.CONDOM_EFFECT.skin_hair || CONFIG.CONDOM_EFFECT.skin;
        } else if (disease.riskType === 'fluid' || disease.riskType === 'fluid_mucous') {
            condomMult = CONFIG.CONDOM_EFFECT.fluid;
        } else {
            condomMult = CONFIG.CONDOM_EFFECT.contact;
        }

        chance *= condomMult;

        // 口交戴套额外折扣（默认 1.0，即不额外打折）
        if (actionType === 'oral_condom') {
            chance *= CONFIG.ORAL_CONDOM_EXTRA_MULT;
        }
    }

    // 累积暴露修正
    if (CONFIG.CUMULATIVE.enabled) {
        const exposures = STATE.exposureCounts[disease.key] || 0;
        if (exposures > 0) {
            chance = Math.min(
                chance * Math.pow(CONFIG.CUMULATIVE.multiplier, exposures),
                CONFIG.CUMULATIVE.cap
            );
        }
    }

    // 全局上限保护（防止基准值或计算后超过 cap）
    return Math.min(chance, CONFIG.CUMULATIVE.cap);
}

// ==========================================
// 核心行为处理
// ==========================================

function takeAction(actionType) {
    if (STATE.frustration >= 100 || STATE.anxiety >= 100) return;

    if (actionType === 'chat') {
        const p = STATE.currentPartner;
        const hiddenIndices = p.tags.map((t, i) => !t.revealed ? i : -1).filter(i => i !== -1);
        if (hiddenIndices.length > 0) {
            const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
            p.tags[idx].revealed = true;
            if (!advanceTime(roll(CONFIG.chatCost), 0)) renderPartner();
        } else {
            if (!advanceTime(roll(CONFIG.chatCost), 0)) renderPartner();
        }
        return;
    }

    const partner = STATE.currentPartner;
    let infectedThisTurn = false;

    if (actionType === 'refuse') {
        recordHistory('refuse', false);
        if (!advanceTime(roll(CONFIG.passiveGain) + roll(CONFIG.refuseCost), 0)) {
            showFeedback("继续寻找", "你选择了离开。压抑值上升，但至少你暂时是安全的。", "🏃");
        }
        return;
    }

    const reduction = roll(CONFIG.rewards[actionType]);
    let anxietyGain = roll(CONFIG.stress[actionType]);

    // 体征缩放：每个可见高危体征增加焦虑；试纸阴性后清零
    if (partner.testedNegative) {
        anxietyGain = 0;
    } else {
        const visibleSigns = partner.tags.filter(t =>
            t.revealed && (t.color.includes('red') || t.color.includes('purple'))
        ).length;
        if (visibleSigns > 0) {
            const signMult = Math.min(
                1 + visibleSigns * CONFIG.ANXIETY_SIGN.perSignMultiplier,
                CONFIG.ANXIETY_SIGN.maxMultiplier
            );
            anxietyGain = Math.round(anxietyGain * signMult);
        }
    }

    // ---- 感染判定（允许多疾病同时感染） ----
    // 戴套行为先统一判定是否破损（每回合一次，非每种疾病一次）
    let condomFailed = false;
    if (actionType.includes('condom') && partner.diseases.length > 0) {
        condomFailed = Math.random() < CONFIG.CONDOM_FAILURE_RATE;
    }

    let newInfections = [];  // 本回合新感染的疾病 key 列表

    if (partner.diseases.length > 0) {
        for (let dKey of partner.diseases) {
            // 已经感染过的疾病不再重复判定
            if (STATE.infections.includes(dKey)) continue;

            const disease = DISEASES[dKey];
            const chance = getTransmissionChance(actionType, disease, condomFailed);

            // 记录暴露（仅当对方携带该病原且行为有传播风险时）
            if (chance > 0) {
                STATE.exposureCounts[dKey] = (STATE.exposureCounts[dKey] || 0) + 1;
            }

            if (Math.random() < chance) {
                STATE.infections.push(dKey);
                STATE.isInfected = true;
                newInfections.push(dKey);
            }
        }
    }

    infectedThisTurn = newInfections.length > 0;

    recordHistory(actionType, infectedThisTurn, newInfections);

    // 安全行为低概率获得试纸
    let gainedKit = false;
    if (!infectedThisTurn && (actionType === 'sex_condom' || actionType === 'oral_condom')) {
        const kitChance = CONFIG.TESTKIT_CHANCE[actionType] || 0;
        if (Math.random() < kitChance) {
            STATE.items.testkit++;
            gainedKit = true;
        }
    }

    STATE.frustration -= reduction;
    const frustrationDelta = roll(CONFIG.passiveGain) - reduction;

    if (advanceTime(frustrationDelta, anxietyGain)) return;

    if (STATE.frustration < 0) STATE.frustration = 0;

    if (STATE.frustration === 0) {
        if (STATE.isInfected) {
            showGameOver("糟糕的胜利", "你的压抑值清零了，你感到无比轻松...<br>但在几天后，你的身体开始出现异常反应。<br>你虽然释放了欲望，却输掉了健康。", "🥀", STATE.infections);
        } else {
            showWin();
        }
    } else {
        let title = "宣泄与不安";
        let icon = "🍬";
        let msg = `欲望得到了释放。<br>生理压抑 <span class="text-emerald-400">-${reduction}</span>`;

        if (anxietyGain > 5) {
            msg += `<br>心理压力 <span class="text-violet-400">+${anxietyGain}</span>`;
            icon = "😰";
        }

        if (gainedKit) {
            msg += `<br><span class="text-sky-400">🧪 获得 1 个检测试纸！</span>`;
        }

        if (condomFailed) {
            msg += `<br><span class="text-rose-400 font-bold">⚠️ 安全套破裂/滑脱！</span>`;
            icon = "😱";
        }

        if (STATE.isInfected) {
            msg += `<br><span class="text-xs text-slate-500 italic mt-2">你感觉到了一丝异样，但也许只是错觉...？</span>`;
        } else if (partner.diseases.length > 0) {
            msg += `<br><span class="text-xs text-slate-500 italic mt-2">虽然过程很惊险，但你似乎运气不错...暂时。</span>`;
        }

        showFeedback(title, msg, icon);
    }
}

// ==========================================
// 道具使用
// ==========================================

function useItem(type) {
    if (type === 'testkit' && STATE.items.testkit > 0) {
        STATE.items.testkit--;
        const p = STATE.currentPartner;
        const actuallySick = p.diseases.length > 0;
        let msg = "", icon = "";
        let showEdu = false;

        // 试纸准确性判定：假阴性 / 假阳性
        const rollAccuracy = Math.random();
        let testShowsPositive;

        if (actuallySick) {
            // 真·有病 → 通常阳性，但可能假阴性
            testShowsPositive = rollAccuracy >= CONFIG.TESTKIT_ACCURACY.falseNegativeRate;
        } else {
            // 真·无病 → 通常阴性，但可能假阳性
            testShowsPositive = rollAccuracy < CONFIG.TESTKIT_ACCURACY.falsePositiveRate;
        }

        if (testShowsPositive) {
            // 显示阳性
            if (actuallySick) {
                const names = p.diseases.map(d => DISEASES[d].name).join(", ");
                msg = `<span class="text-rose-400 font-bold">⚠️ 阳性反应！</span><br>病原体：${names}。<br>请立即离开。`;
                showEdu = true;
            } else {
                // 假阳性：显示阳性但实际无病
                msg = `<span class="text-rose-400 font-bold">⚠️ 阳性反应！</span><br>检测到异常反应。<br><span class="text-amber-400 text-xs">（注：快速试纸存在假阳性可能，建议去医院确证）</span>`;
            }
            icon = "🦠";
            document.getElementById('partner-status').classList.remove('hidden');
            p._statusShown = true;
        } else {
            // 显示阴性
            if (actuallySick) {
                // 假阴性：有病但显示阴性
                msg = `<span class="text-emerald-400 font-bold">✅ 阴性。</span><br>未检测到常见病原体。<br><span class="text-amber-400 text-xs">（注：可能存在窗口期，无法完全排除感染）</span>`;
            } else {
                msg = `<span class="text-emerald-400 font-bold">✅ 阴性。</span><br>未检测到常见病原体。`;
            }
            icon = "🛡️";
            // 检测阴性 → 标记伴侣已检测，消除体征焦虑
            p.testedNegative = true;
        }

        p.tags.forEach(t => t.revealed = true);
        renderPartner();
        updateStatsUI();
        showFeedback("检测结果", msg, icon, true, showEdu && actuallySick ? p.diseases : null);
    }
}

// ==========================================
// 去医院检查
// ==========================================

function goToHospital() {
    const survive = !advanceTime(roll(CONFIG.hospitalCost), 0);
    if (!survive) return;

    STATE.anxiety = 0;
    updateStatsUI();

    if (STATE.isInfected) {
        showGameOver("确诊感染", `很遗憾，医院的检查结果显示你已感染。<br>之前的侥幸心理终究没能救你。`, "🏥", STATE.infections);
    } else {
        STATE.items.testkit++;
        updateStatsUI();
        showFeedback("虚惊一场", "<span class='text-emerald-400 font-bold'>检测结果阴性。</span><br>你身体是健康的。心理压力已清空。<br><span class='text-sky-400'>🧪 获得 1 个检测试纸</span>", "🏥", true);
    }
}

// ==========================================
// 下一回合
// ==========================================

function nextTurn() {
    document.getElementById('feedback-overlay').classList.add('hidden');
    toggleHistoryView(false);
    generateNewPartner();
}

// ==========================================
// 历史记录
// ==========================================

function recordHistory(action, infectedThisTurn, newInfections = []) {
    const p = STATE.currentPartner;
    let outcomeLabel = "", outcomeClass = "";

    const isDiseased = p.diseases.length > 0;

    if (action === 'refuse') {
        if (isDiseased) {
            outcomeLabel = "🛡️ 正确离开"; outcomeClass = "text-emerald-400 border-emerald-500/30 bg-emerald-900/20";
        } else {
            outcomeLabel = "👋 遗憾错过"; outcomeClass = "text-slate-400 border-slate-500/30 bg-slate-800";
        }
    } else {
        if (infectedThisTurn) {
            outcomeLabel = "💀 被ta感染"; outcomeClass = "text-rose-500 border-rose-500/30 bg-rose-900/30";
        } else if (isDiseased) {
            outcomeLabel = "😰 死里逃生"; outcomeClass = "text-amber-400 border-amber-500/30 bg-amber-900/20";
        } else {
            outcomeLabel = "✅ 理智享受"; outcomeClass = "text-blue-400 border-blue-500/30 bg-blue-900/20";
        }
    }

    STATE.history.push({
        avatar: p.avatar,
        tags: p.tags,
        diseases: p.diseases,
        action: action,
        outcomeLabel: outcomeLabel,
        outcomeClass: outcomeClass,
        caughtDiseases: [...newInfections]  // 本回合被感染的疾病列表
    });
}
