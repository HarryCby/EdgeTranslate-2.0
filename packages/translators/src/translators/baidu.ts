import type { AxiosResponse } from "axios";
import axios from "../axios";
import {
    PronunciationSpeed,
    TranslationResult,
} from "../types";
import md5 from "blueimp-md5";

/**
 * Supported languages — mapped to Baidu Official API language codes.
 */
const LANGUAGES: [string, string][] = [
    ["auto", "auto"],
    ["zh-CN", "zh"],
    ["zh-TW", "cht"],
    ["en", "en"],
    ["ja", "jp"],
    ["ko", "kor"],
    ["fr", "fra"],
    ["es", "spa"],
    ["it", "it"],
    ["de", "de"],
    ["ru", "ru"],
    ["pt", "pt"],
    ["vi", "vie"],
    ["id", "id"],
    ["th", "th"],
    ["ms", "may"],
    ["ar", "ara"],
    ["hi", "hi"],
];

/**
 * Generate Baidu API sign: MD5(appid + text + salt + key)
 */
function generateSign(appid: string, text: string, salt: string, key: string): string {
    return md5(appid + text + salt + key);
}

/**
 * Baidu Official Translation API translator.
 */
class BaiduTranslator {
    appId: string;
    appKey: string;

    MAX_RETRY = 1;

    /**
     * Baidu Official API endpoint.
     */
    ENDPOINT = "https://fanyi-api.baidu.com/api/trans/vip/translate";

    /**
     * TTS endpoint (kept from old implementation).
     */
    TTS_HOST = "https://fanyi.baidu.com/";

    /**
     * Language to translator language code.
     */
    LAN_TO_CODE = new Map(LANGUAGES);

    /**
     * Translator language code to language.
     */
    CODE_TO_LAN = new Map(LANGUAGES.map(([lan, code]) => [code, lan]));

    /**
     * TTS audio instance.
     */
    AUDIO = new Audio();

    constructor(appId: string, appKey: string) {
        this.appId = appId;
        this.appKey = appKey;
    }

    /**
     * Get supported languages of this API.
     */
    supportedLanguages() {
        return new Set(this.LAN_TO_CODE.keys());
    }

    /**
     * Detect language of given text.
     *
     * Baidu API returns the detected source language in the translate response.
     */
    async detect(text: string): Promise<string> {
        const salt = String(Date.now());
        const sign = generateSign(this.appId, text, salt, this.appKey);

        const response = (await axios({
            method: "GET",
            url: this.ENDPOINT,
            params: {
                q: text.substring(0, 100), // Only need first 100 chars for detection
                from: "auto",
                to: "zh",
                appid: this.appId,
                salt,
                sign,
            },
        })) as AxiosResponse<any>;

        if (response.data.error_code) {
            throw {
                errorType: "API_ERR",
                errorCode: response.data.error_code,
                errorMsg: response.data.error_msg || "Detect failed.",
                errorAct: { api: "baidu", action: "detect", text, from: null, to: null },
            };
        }

        const lang = response.data.from;
        return this.CODE_TO_LAN.get(lang) || lang;
    }

    /**
     * Translate given text.
     */
    async translate(text: string, from: string, to: string) {
        let retryCount = 0;

        const translateOnce = async (): Promise<TranslationResult> => {
            const salt = String(Date.now());
            const sign = generateSign(this.appId, text, salt, this.appKey);

            const response = (await axios({
                method: "GET",
                url: this.ENDPOINT,
                params: {
                    q: text,
                    from: this.LAN_TO_CODE.get(from) || "auto",
                    to: this.LAN_TO_CODE.get(to) || "zh",
                    appid: this.appId,
                    salt,
                    sign,
                },
            })) as AxiosResponse<any>;

            const data = response.data;

            if (data.error_code) {
                // Retry on general errors
                if (retryCount < this.MAX_RETRY) {
                    retryCount++;
                    return translateOnce();
                }

                throw {
                    errorType: "API_ERR",
                    errorCode: data.error_code,
                    errorMsg: data.error_msg || "Translate failed.",
                    errorAct: { api: "baidu", action: "translate", text, from, to },
                };
            }

            const result: TranslationResult = {
                originalText: "",
                mainMeaning: "",
            };

            // Parse translation results
            const originalTexts: string[] = [];
            const mainMeanings: string[] = [];
            if (data.trans_result) {
                for (const item of data.trans_result) {
                    originalTexts.push(item.src);
                    mainMeanings.push(item.dst);
                }
            }
            result.originalText = originalTexts.join("\n") || text;
            result.mainMeaning = mainMeanings.join("\n");

            return result;
        };

        return translateOnce();
    }

    /**
     * Pronounce given text.
     */
    async pronounce(text: string, language: string, speed: PronunciationSpeed) {
        this.stopPronounce();

        const speedValue = speed === "fast" ? "7" : "3";

        this.AUDIO.src = `${this.TTS_HOST}gettts?lan=${this.LAN_TO_CODE.get(
            language
        )}&text=${encodeURIComponent(text)}&spd=${speedValue}&source=web`;

        try {
            await this.AUDIO.play();
        } catch (error: any) {
            throw {
                errorType: "NET_ERR",
                errorCode: 0,
                errorMsg: error.message,
                errorAct: {
                    api: "baidu",
                    action: "pronounce",
                    text,
                    from: language,
                    to: null,
                },
            };
        }
    }

    /**
     * Pause pronounce.
     */
    stopPronounce() {
        if (!this.AUDIO.paused) {
            this.AUDIO.pause();
        }
    }
}

export default BaiduTranslator;
