import type { AxiosResponse } from "axios";
import axios from "../axios";
import { PronunciationSpeed, TranslationResult } from "../types";

/**
 * Supported languages — mapped to Youdao dict API language codes.
 */
const LANGUAGES: [string, string][] = [
    ["auto", "auto"],
    ["zh-CN", "zh-CHS"],
    ["zh-TW", "zh-CHT"],
    ["en", "eng"],
    ["ja", "jp"],
    ["ko", "kr"],
    ["fr", "fr"],
    ["es", "es"],
    ["it", "it"],
    ["de", "de"],
    ["ru", "ru"],
    ["pt", "pt"],
    ["vi", "vi"],
    ["id", "id"],
    ["th", "th"],
    ["ms", "ms"],
    ["ar", "ar"],
    ["hi", "hi"],
];

/**
 * Map our language code to Youdao dict API 'le' parameter.
 */
const LANG_TO_LE: Record<string, string> = {
    "en": "eng", "zh-CN": "zh-CHS", "zh-TW": "zh-CHT",
    "ja": "jp", "ko": "kr", "fr": "fr", "es": "es",
    "de": "de", "it": "it", "ru": "ru", "pt": "pt",
};

/**
 * Youdao Web Dictionary API translator.
 * Uses the free dict.youdao.com/jsonapi_s endpoint — no API key required.
 */
class YoudaoTranslator {
    /**
     * Youdao dict API endpoint.
     */
    ENDPOINT = "https://dict.youdao.com/jsonapi_s";

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

    /**
     * No credentials needed — web scraping is free.
     */
    constructor(_appKey?: string, _appSecret?: string) {
        // Keep constructor signature for backwards compatibility with hybrid.ts
    }

    /**
     * Get supported languages of this API.
     */
    supportedLanguages() {
        return new Set(this.LAN_TO_CODE.keys());
    }

    /**
     * Detect language — Youdao dict API returns detected language.
     */
    async detect(text: string): Promise<string> {
        try {
            const data = await this.fetchDict(text, "eng");
            if (data.simple?.word?.[0]?.returnPhrase) return "en";
            // Try zh-CHS
            const data2 = await this.fetchDict(text, "zh-CHS");
            if (data2.simple?.word?.[0]?.returnPhrase) return "zh-CN";
        } catch { /* fall through */ }
        return "en"; // default
    }

    /**
     * Fetch dictionary data from Youdao API.
     */
    async fetchDict(text: string, le: string) {
        const response = (await axios({
            method: "GET",
            url: this.ENDPOINT,
            params: { doctype: "json", jsonversion: "4", q: text, le },
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://dict.youdao.com/",
            },
        })) as AxiosResponse<any>;
        return response.data;
    }

    /**
     * Translate given text.
     */
    /**
     * Normalize text for dictionary lookup: lowercase for case-insensitive matching.
     */
    normalizeForDict(text: string): string {
        return text.toLowerCase();
    }

    async translate(text: string, from: string, to: string) {
        try {
            // Clear old audio cache before new translation
            this.clearAudioCache();

            const lang = this.LAN_TO_CODE.get(from) || "auto";
            const le = LANG_TO_LE[lang] || "auto";
            const dictText = this.normalizeForDict(text);
            const data = await this.fetchDict(dictText, le);
            const result = this.parseResult(data, text);

            // Preload TTS audio for the word
            this.preloadAudio(text, from);

            return result;
        } catch (error: any) {
            error.errorAct = {
                api: "youdao",
                action: "translate",
                text,
                from,
                to,
            };
            throw error;
        }
    }

    /**
     * Youdao returns some dict fields as Python-style strings (single quotes).
     * Convert them to proper JSON objects.
     */
    private parseField(field: any): any {
        if (typeof field === "string") {
            try {
                return JSON.parse(field.replace(/'/g, '"').replace(/\\xa0/g, " ").replace(/\\u([\dA-Fa-f]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16))));
            } catch { return field; }
        }
        return field;
    }

    /**
     * Parse Youdao web API response into TranslationResult.
     */
    parseResult(data: any, originalText: string): TranslationResult {
        const result: TranslationResult = {
            originalText: originalText,
            mainMeaning: "",
        };

        // ── Phonetics (US/UK) ──
        const simple = this.parseField(data.simple);
        const word = simple?.word?.[0];
        const returnedPhrase = word?.["return-phrase"] || "";

        // Guard: if returnedPhrase doesn't match at all, API gave us junk data
        if (returnedPhrase && originalText && !originalText.toLowerCase().includes(returnedPhrase.toLowerCase()) && !returnedPhrase.toLowerCase().includes(originalText.toLowerCase())) {
            return result; // discard corrupt data
        }

        if (word) {
            const us = word.usphone || "";
            const uk = word.ukphone || "";
            result.sPronunciation = us;
            result.tPronunciation = uk;
            result.originalText = returnedPhrase || originalText;
        }

        // ── Main meaning + detailed from ec.word.trs (reliable dictionary data for words) ──
        const ec = this.parseField(data.ec);
        const ecWord = ec?.word;
        const trs = ecWord?.trs;

        // Check if trs has POS-tagged entries (dictionary mode for single words)
        const hasPOS = trs && trs.some((e: any) => e.pos);

        if (hasPOS && trs) {
            // Single word with dictionary data
            result.detailedMeanings = [];
            for (const entry of trs) {
                if (!entry.tran) continue;
                const meanings = entry.tran
                    .replace(/<[^>]+>/g, "")
                    .replace(/（[^）]*）/g, "")
                    .split(/[；;，,]/)
                    .map((s: string) => s.trim())
                    .filter((s: string) => s.length > 0 && s.length < 30);

                if (meanings.length > 0) {
                    if (!result.mainMeaning) result.mainMeaning = meanings[0];
                    result.detailedMeanings!.push({
                        pos: entry.pos || "",
                        meaning: meanings.join("，"),
                    });
                }
            }
        } else {
            // Sentence or phrase — use web_trans for mainMeaning
            const webTrans = ec?.web_trans;
            if (webTrans && webTrans.length > 0) {
                result.mainMeaning = webTrans[0];
            }
        }

        // ── Domain-specific meanings (ec.special) ──
        const specials = ec?.special;
        if (specials && specials.length > 0) {
            if (!result.detailedMeanings) result.detailedMeanings = [];
            for (const sp of specials) {
                result.detailedMeanings.push({
                    pos: sp.major || "",
                    meaning: sp.nat || "",
                });
            }
        }

        const syno = this.parseField(data.syno);
        const synos = syno?.synos;
        if (synos && synos.length > 0) {
            if (!result.detailedMeanings) result.detailedMeanings = [];
            for (const s of synos) {
                result.detailedMeanings.push({
                    pos: s.pos || "",
                    meaning: s.tran || "",
                    synonyms: s.ws || [],
                });
            }
        }

        // ── Collins definitions with examples ──
        const collins = this.parseField(data.collins);
        const collinsEntries = collins?.collins_entries;
        if (collinsEntries && collinsEntries.length > 0) {
            const definitions: any[] = [];
            for (const ce of collinsEntries) {
                for (const entry of ce.entries?.entry || []) {
                    for (const te of entry.tran_entry || []) {
                        const sent = te.exam_sents?.sent?.[0];
                        if (te.pos_entry) {
                            definitions.push({
                                pos: te.pos_entry.pos || "",
                                meaning: te.pos_entry.pos_tips || "",
                                example: sent ? `${sent.eng_sent} ｜ ${sent.chn_sent}` : undefined,
                            });
                        }
                    }
                }
            }
            if (definitions.length > 0) result.definitions = definitions;
        }

        // ── Phrase examples ──
        const phrs = this.parseField(data.phrs);
        const phraseList = phrs?.phrs;
        if (phraseList && phraseList.length > 0 && !result.examples) {
            result.examples = phraseList.slice(0, 8).map((p: any) => ({
                source: p.headword || "",
                target: p.translation || "",
            }));
        }

        return result;
    }

    // TTS cache: text|accent → blob URL, cleared on next translate
    static _ttsCache: Map<string, string> = new Map();

    /**
     * Preload TTS audio for a word (call after translate).
     */
    preloadAudio(text: string, language: string) {
        // Preload both US (type=2) and UK (type=1)
        for (const [accent, type] of [["US", "2"], ["UK", "1"]]) {
            const key = text + "|" + accent;
            if (YoudaoTranslator._ttsCache.has(key)) continue;
            const ttsUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=${this.LAN_TO_CODE.get(language) || "en"}&type=${type}`;
            fetch(ttsUrl)
                .then((r) => r.blob())
                .then((blob) => YoudaoTranslator._ttsCache.set(key, URL.createObjectURL(blob)))
                .catch(() => {});
        }
    }

    /**
     * Pronounce given text — US (type=2) by default, UK (type=1) for sourceUK.
     */
    async pronounce(text: string, language: string, speed: PronunciationSpeed, pronouncing?: string) {
        void speed;
        this.stopPronounce();

        const accent = pronouncing === "sourceUK" ? "UK" : "US";
        const type = pronouncing === "sourceUK" ? "1" : "2";
        const key = text + "|" + accent;
        const cached = YoudaoTranslator._ttsCache.get(key);

        if (cached) {
            this.AUDIO.src = cached;
        } else {
            this.AUDIO.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=${this.LAN_TO_CODE.get(language) || "en"}&type=${type}`;
        }

        try {
            await this.AUDIO.play();
        } catch (error: any) {
            throw {
                errorType: "NET_ERR",
                errorCode: 0,
                errorMsg: error.message,
                errorAct: { api: "youdao", action: "pronounce", text, from: language, to: null },
            };
        }
    }

    /**
     * Clear TTS cache — call before new translation.
     */
    clearAudioCache() {
        for (const url of YoudaoTranslator._ttsCache.values()) {
            try { URL.revokeObjectURL(url); } catch {}
        }
        YoudaoTranslator._ttsCache.clear();
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

export default YoudaoTranslator;
