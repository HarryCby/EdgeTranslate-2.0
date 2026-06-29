/** @jsx h */
import { h, render } from "preact";
import Panel from "./Panel.jsx";

(async function initialize() {
    // 加载自定义 i18n 语言包
    await initDisplayI18n();
    // 加载主题
    await initTheme();
    render(<Panel />, document.documentElement);
    // Prepare this polyfill for the useMeasure hook of "react-use".
    if (!window.ResizeObserver) {
        window.ResizeObserver = (await import("resize-observer-polyfill")).default;
    }
})();

// Re-render panel when UI language changes
chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "sync" && changes["UILanguage"]) {
        window.__i18nMessages = null;
        await initDisplayI18n();
        render(<Panel />, document.documentElement);
    }
});

/**
 * Apply theme to document.documentElement.dataset.etTheme.
 */
function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme:dark)").matches)) {
        root.dataset.etTheme = "dark";
    } else {
        root.dataset.etTheme = "light";
    }
}

/**
 * Load theme from storage and listen for changes.
 */
async function initTheme() {
    const result = await new Promise((resolve) => {
        chrome.storage.sync.get(["OtherSettings"], resolve);
    });
    applyTheme(result.OtherSettings?.Theme || "light");

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" && changes["OtherSettings"]) {
            applyTheme(changes["OtherSettings"].newValue?.Theme || "light");
            // Re-render panel so styled-components re-evaluate with
            // the new CSS variable values (same pattern as UILanguage change).
            render(<Panel />, document.documentElement);
        }
    });

    window.matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () => {
        chrome.storage.sync.get(["OtherSettings"], (result) => {
            if (result.OtherSettings?.Theme === "system") applyTheme("system");
        });
    });
}

/**
 * 为翻译结果面板加载自定义 i18n
 */
async function initDisplayI18n() {
    try {
        // 从 storage 读取界面语言
        const result = await new Promise((resolve) => {
            chrome.storage.sync.get(["UILanguage"], resolve);
        });
        const lang = result.UILanguage || "zh_CN";
        const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
        const resp = await fetch(url);
        const data = await resp.json();
        window.__i18nMessages = {};
        for (const key in data) {
            if (data[key].message) {
                window.__i18nMessages[key] = data[key].message;
            }
        }
        window.__i18nLang = lang;
    } catch (e) {
        // fallback to browser language
    }

    // 全局 i18n 辅助函数
    window.__i18n = function (key, subs) {
        if (window.__i18nMessages && window.__i18nMessages[key]) {
            let msg = window.__i18nMessages[key];
            if (subs && subs.length) {
                for (let i = 0; i < subs.length; i++) {
                    msg = msg.replace('$' + (i + 1), subs[i]);
                }
            }
            return msg;
        }
        return chrome.i18n.getMessage(key, subs);
    };
}
