import Channel from "common/scripts/channel.js";
import { i18nHTML, i18nMsg, loadI18nMessages } from "common/scripts/common.js";
import { DEFAULT_SETTINGS, getOrSetDefaultSettings } from "common/scripts/settings.js";
import { LANGUAGES } from "@edge_translate/translators";

/**
 * Communication channel.
 */
const channel = new Channel();

/**
 * 初始化设置列表
 */
window.onload = async () => {
    // 先加载自定义 i18n 语言包
    await initI18n();

    // 初始化界面语言选择器
    initUILanguage();

    // 设置不同语言的隐私政策链接
    let PrivacyPolicyLink = document.getElementById("PrivacyPolicyLink");
    PrivacyPolicyLink.setAttribute("href", i18nMsg("PrivacyPolicyLink"));

    /**
     * Set up hybrid translate config.
     */
    getOrSetDefaultSettings(["languageSetting", "HybridTranslatorConfig"], DEFAULT_SETTINGS).then(
        async (result) => {
            let config = result.HybridTranslatorConfig;
            let languageSetting = result.languageSetting;
            let availableTranslators = await channel.request("get_available_translators", {
                from: languageSetting.sl,
                to: languageSetting.tl,
            });
            setUpTranslateConfig(
                config,
                // Remove the hybrid translator at the beginning of the availableTranslators array.
                availableTranslators.slice(1)
            );
        }
    );

    /**
     * Update translator config options on translator config update.
     */
    channel.on("hybrid_translator_config_updated", (detail) =>
        setUpTranslateConfig(detail.config, detail.availableTranslators)
    );

    /**
     * initiate and update settings
     * attribute "setting-type": indicate the setting type of one option
     * attribute "setting-path": indicate the nested setting path. used to locate the path of one setting item in chrome storage
     */
    getOrSetDefaultSettings(undefined, DEFAULT_SETTINGS).then((result) => {
        let inputElements = document.getElementsByTagName("input");
        const selectTranslatePositionElement = document.getElementById("select-translate-position");
        for (let element of [...inputElements, selectTranslatePositionElement]) {
            let settingItemPath = element.getAttribute("setting-path").split(/\s/g);
            let settingItemValue = getSetting(result, settingItemPath);

            switch (element.getAttribute("setting-type")) {
                case "checkbox":
                    element.checked = settingItemValue.indexOf(element.value) !== -1;
                    // update setting value
                    element.onchange = (event) => {
                        const target = event.target;
                        const settingItemPath = target.getAttribute("setting-path").split(/\s/g);
                        const settingItemValue = getSetting(result, settingItemPath);

                        // if user checked this option, add value to setting array
                        if (target.checked) settingItemValue.push(target.value);
                        // if user unchecked this option, delete value from setting array
                        else settingItemValue.splice(settingItemValue.indexOf(target.value), 1);
                        saveOption(result, settingItemPath, settingItemValue);
                    };
                    break;
                case "radio":
                    element.checked = settingItemValue === element.value;
                    // update setting value
                    element.onchange = (event) => {
                        const target = event.target;
                        const settingItemPath = target.getAttribute("setting-path").split(/\s/g);
                        if (target.checked) {
                            saveOption(result, settingItemPath, target.value);
                        }
                    };
                    break;
                case "switch":
                    element.checked = settingItemValue;
                    // update setting value
                    element.onchange = (event) => {
                        const settingItemPath = event.target
                            .getAttribute("setting-path")
                            .split(/\s/g);
                        saveOption(result, settingItemPath, event.target.checked);
                    };
                    break;
                case "select":
                    element.value = settingItemValue;
                    // update setting value
                    element.onchange = (event) => {
                        const target = event.target;
                        const settingItemPath = target.getAttribute("setting-path").split(/\s/g);
                        saveOption(
                            result,
                            settingItemPath,
                            target.options[target.selectedIndex].value
                        );
                    };
                    break;
                case "text":
                    element.value = settingItemValue || "";
                    // update setting value on blur (save on input loses focus)
                    element.onblur = (event) => {
                        const settingItemPath = event.target
                            .getAttribute("setting-path")
                            .split(/\s/g);
                        saveOption(result, settingItemPath, event.target.value);
                    };
                    break;
                default:
                    break;
            }
        }
    });
};

/**
 * Set up hybrid translate config.
 *
 * @param {Object} config translator config
 * @param {Array<String>} availableTranslators available translators for current language setting
 *
 * @returns {void} nothing
 */
function setUpTranslateConfig(config, availableTranslators) {
    let translatorConfigEles = document.getElementsByClassName("translator-config");

    for (let ele of translatorConfigEles) {
        // Remove existed options.
        for (let i = ele.options.length; i > 0; i--) {
            ele.options.remove(i - 1);
        }

        // data-affected indicates items affected by this element in config.selections, they always have the same value.
        let affected = ele.getAttribute("data-affected").split(/\s/g);
        let selected = config.selections[affected[0]];
        for (let translator of availableTranslators) {
            if (translator === selected) {
                ele.options.add(
                    new Option(i18nMsg(translator), translator, true, true)
                );
            } else {
                ele.options.add(new Option(i18nMsg(translator), translator));
            }
        }

        ele.onchange = () => {
            let value = ele.options[ele.selectedIndex].value;
            for (let item of affected) {
                config.selections[item] = value;
            }

            // Get the new selected translator set.
            let translators = new Set();
            config.translators = [];
            for (let item in config.selections) {
                let translator = config.selections[item];
                if (!translators.has(translator)) {
                    config.translators.push(translator);
                    translators.add(translator);
                }
            }

            chrome.storage.sync.set({ HybridTranslatorConfig: config });
        };
    }
}

/**
 *
 * get setting value according to path of setting item
 *
 * @param {Object} localSettings setting object stored in local
 * @param {Array} settingItemPath path of the setting item
 * @returns {*} setting value
 */
function getSetting(localSettings, settingItemPath) {
    let result = localSettings;
    settingItemPath.forEach((key) => {
        result = result[key];
    });
    return result;
}

/**
 * Dynamic AI configs management.
 */
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("ai-configs-container");
    const addBtn = document.getElementById("add-ai-config-btn");
    if (!container || !addBtn) return;

    function makeConfigHTML(cfg, idx) {
        return `<div class="ai-config-entry" data-idx="${idx}">
            <div class="ai-config-header">
                <span class="ai-config-index">${i18nMsg("AiModelIndex", [String(idx + 1)])}</span>
                <button class="ai-config-remove" data-idx="${idx}">×</button>
            </div>
            <div class="api-config-row">
                <label class="api-config-label">${i18nMsg("AiModelName")}</label>
                <input type="text" class="api-key-input ai-display-name" value="${esc(cfg.displayName || '')}" placeholder="DeepSeek" spellcheck="false" />
            </div>
            <div class="api-config-row">
                <label class="api-config-label">${i18nMsg("AiApiUrl")}</label>
                <input type="text" class="api-key-input ai-api-url" value="${esc(cfg.apiUrl || '')}" placeholder="https://api.deepseek.com" spellcheck="false" />
            </div>
            <div class="api-config-row">
                <label class="api-config-label">${i18nMsg("AiApiKey")}</label>
                <input type="password" class="api-key-input ai-api-key" value="${esc(cfg.apiKey || '')}" placeholder="sk-..." spellcheck="false" />
            </div>
            <div class="api-config-row">
                <label class="api-config-label">${i18nMsg("AiModelLabel")}</label>
                <input type="text" class="api-key-input ai-model" value="${esc(cfg.model || '')}" placeholder="deepseek-chat" spellcheck="false" />
            </div>
        </div>`;
    }

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function saveAIConfigs() {
        const entries = container.querySelectorAll(".ai-config-entry");
        const configs = [];
        entries.forEach((entry) => {
            configs.push({
                displayName: entry.querySelector(".ai-display-name")?.value || "",
                apiUrl: entry.querySelector(".ai-api-url")?.value || "",
                apiKey: entry.querySelector(".ai-api-key")?.value || "",
                model: entry.querySelector(".ai-model")?.value || "",
            });
        });
        chrome.storage.sync.set({ AIConfigs: configs });
    }

    function renderAll(configs) {
        container.innerHTML = configs.map((c, i) => makeConfigHTML(c, i)).join("");
        // Bind remove buttons
        container.querySelectorAll(".ai-config-remove").forEach((btn) => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx);
                configs.splice(idx, 1);
                renderAll(configs);
                saveAIConfigs();
            };
        });
        // Bind input changes
        container.querySelectorAll("input").forEach((inp) => {
            inp.onblur = () => saveAIConfigs();
        });
    }

    // Load existing configs
    chrome.storage.sync.get(["AIConfigs"], (result) => {
        const configs = result.AIConfigs || [];
        renderAll(configs);
    });

    // Add button
    addBtn.onclick = () => {
        chrome.storage.sync.get(["AIConfigs"], (result) => {
            const configs = result.AIConfigs || [];
            configs.push({ displayName: "", apiUrl: "", apiKey: "", model: "" });
            renderAll(configs);
            saveAIConfigs();
        });
    };
});

/**
 * Export API keys to a JSON file.
 */
document.addEventListener("DOMContentLoaded", () => {
    const exportBtn = document.getElementById("export-keys-btn");
    const importBtn = document.getElementById("import-keys-btn");
    const importFile = document.getElementById("import-keys-file");

    if (exportBtn) {
        exportBtn.onclick = () => {
            // 导出所有 API 密钥、代理、AI 模型配置
            const keys = ["TencentTranslateConfig", "BaiduTranslateConfig", "YoudaoTranslateConfig", "GoogleTranslateConfig", "AIConfigs"];
            chrome.storage.sync.get(keys, (result) => {
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "edge-translate-config.json";
                a.click();
                URL.revokeObjectURL(url);
            });
        };
    }

    if (importBtn && importFile) {
        importBtn.onclick = () => importFile.click();
        importFile.onchange = () => {
            const file = importFile.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    chrome.storage.sync.set(config, () => {
                        alert(i18nMsg("AppName") + "：" + i18nMsg("ConfigImported"));
                        location.reload();
                    });
                } catch (err) {
                    alert(i18nMsg("ImportFailed"));
                }
            };
            reader.readAsText(file);
        };
    }
});

/**
 * 初始化 i18n：加载自定义语言包，然后渲染界面
 */
async function initI18n() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(["UILanguage"], async (result) => {
            const lang = result.UILanguage || "zh_CN";
            await loadI18nMessages(lang);
            // 渲染 i18n 标签
            i18nHTML();
            // 初始化翻译语言选择器（在 i18n 加载后）
            initDefaultLanguage();
            resolve();
        });
    });
}

/**
 * 初始化默认翻译语言选择器
 */
function initDefaultLanguage() {
    const select = document.getElementById("default-target-language");
    if (!select) return;

    // 填充语言选项
    for (let langCode in LANGUAGES) {
        const name = i18nMsg(LANGUAGES[langCode]);
        select.options.add(new Option(name, langCode));
    }

    // 加载当前默认语言
    chrome.storage.sync.get(["languageSetting"], (result) => {
        if (result.languageSetting && result.languageSetting.tl) {
            select.value = result.languageSetting.tl;
        }
    });

    // 保存语言变更
    select.onchange = () => {
        const tl = select.options[select.selectedIndex].value;
        chrome.storage.sync.get(["languageSetting"], (result) => {
            const langSetting = result.languageSetting || { sl: "auto" };
            langSetting.tl = tl;
            chrome.storage.sync.set({ languageSetting: langSetting });
        });
    };
}

/**
 * 初始化界面语言选择器
 */
function initUILanguage() {
    const select = document.getElementById("ui-language");
    if (!select) return;

    // 设置当前语言
    select.value = window.__i18nLang || "zh_CN";

    // 动态切换语言
    select.onchange = async () => {
        const lang = select.options[select.selectedIndex].value;
        await loadI18nMessages(lang);
        chrome.storage.sync.set({ UILanguage: lang }, () => {
            location.reload();
        });
    };
}

/**
 * 保存一条设置项
 *
 * @param {Object} localSettings  本地存储的设置项
 * @param {Array} settingItemPath 设置项的层级路径
 * @param {*} value 设置项的值
 */
function saveOption(localSettings, settingItemPath, value) {
    // update local settings
    let pointer = localSettings; // point to children of local setting or itself

    // point to the leaf item recursively
    for (let i = 0; i < settingItemPath.length - 1; i++) {
        pointer = pointer[settingItemPath[i]];
    }
    // update the setting leaf value
    pointer[settingItemPath[settingItemPath.length - 1]] = value;

    let result = {};
    result[settingItemPath[0]] = localSettings[settingItemPath[0]];
    chrome.storage.sync.set(result);
}
