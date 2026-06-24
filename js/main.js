/* ============================================
   main.js - 入口文件
   页面加载完成后初始化
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
    // 默认显示合规声明弹窗
    document.getElementById('compliance-modal').classList.remove('hidden');
    document.getElementById('game-container').classList.add('hidden');

    // 所有事件通过 HTML 中的 onclick 属性绑定
    // 此文件作为脚本加载顺序的最后一步
    console.log('🫀 夜择 · 亲密关系模拟 已就绪');
    console.log('📚 疾病科普模块已加载 — 数据来源：WHO、CDC、中国疾控中心');
});
