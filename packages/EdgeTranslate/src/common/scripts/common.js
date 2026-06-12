export { getDomain, log, i18nHTML, i18nMsg, loadI18nMessages };

/**
 * 提取给定的url的域名
 */
function getDomain(url) {
    if (url) {
        let URL_PATTERN = /.+:\/+([\w.-]+).*/;
        let groups = url.match(URL_PATTERN);
        if (groups) {
            return groups[1];
        }
    }
    return "";
}

/**
 * console.log wrapper.
 */
function log(message) {
    // eslint-disable-next-line no-console
    console.log(message);
}

/**
 * 从给定语言的消息文件中加载 i18n 消息
 * @param {string} lang 语言代码
 */
async function loadI18nMessages(lang) {
    try {
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
        return true;
    } catch (e) {
        console.error('[EdgeTranslate] Failed to load i18n:', lang, e);
        return false;
    }
}

/**
 * 获取 i18n 消息，优先使用自定义语言，其次使用浏览器语言
 */
function i18nMsg(key, substitutions) {
    if (window.__i18nMessages && window.__i18nMessages[key]) {
        let msg = window.__i18nMessages[key];
        if (substitutions && substitutions.length) {
            for (let i = 0; i < substitutions.length; i++) {
                msg = msg.replace('$' + (i + 1), substitutions[i]);
            }
        }
        return msg;
    }
    return chrome.i18n.getMessage(key, substitutions);
}

/**
 * 设置 HTML 元素的国际化文本
 */
function i18nHTML() {
    let i18nElements = document.getElementsByClassName("i18n");
    for (let i = 0; i < i18nElements.length; i++) {
        let pos = "beforeEnd";
        if (i18nElements[i].hasAttribute("data-insert-pos")) {
            pos = i18nElements[i].getAttribute("data-insert-pos");
        }

        let msg = i18nMsg(i18nElements[i].getAttribute("data-i18n-name"));
        if (msg) {
            i18nElements[i].insertAdjacentText(pos, msg);
        }
    }

    // 处理 data-i18n-title 属性（用于 tooltip）
    let titleElements = document.querySelectorAll("[data-i18n-title]");
    for (let i = 0; i < titleElements.length; i++) {
        let msg = i18nMsg(titleElements[i].getAttribute("data-i18n-title"));
        if (msg) {
            titleElements[i].setAttribute("title", msg);
        }
    }
}