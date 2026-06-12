/**
 * 有道网页翻译初始化脚本
 * 注入有道翻译的 seed 脚本到页面中
 */
(function () {
    console.log('[EdgeTranslate] Youdao init.js executing...');

    // 如果已经注入过，先移除
    var existing = document.getElementById('youdao-translate-injection');
    if (existing !== null) {
        console.log('[EdgeTranslate] Removing existing injection');
        existing.remove();
    }

    // 移除已有的有道翻译脚本
    var oldSeed = document.getElementById('outfox_seed_js');
    if (oldSeed !== null) {
        console.log('[EdgeTranslate] Removing existing outfox seed');
        oldSeed.remove();
    }

    var s = document.createElement('script');
    s.id = 'youdao-translate-injection';
    s.src = 'https://shared.ydstatic.com/dict/outfox/seed.youdao.js';
    s.setAttribute('edge-translate-url', chrome.runtime.getURL(''));
    console.log('[EdgeTranslate] Injecting Youdao seed script:', s.src);
    s.onload = function() {
        console.log('[EdgeTranslate] Youdao seed script loaded successfully');
    };
    s.onerror = function(e) {
        console.error('[EdgeTranslate] Youdao seed script load failed:', e);
    };
    document.getElementsByTagName('head')[0].appendChild(s);
    console.log('[EdgeTranslate] Script tag appended to head');
})();