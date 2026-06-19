import type { AxiosResponse } from "axios";
import axios from "../axios";
import md5 from "blueimp-md5";
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
    "ja": "ja", "ko": "ko", "fr": "fr", "es": "es",
    "de": "de", "it": "it", "ru": "ru", "pt": "pt",
};

/**
 * Youdao Web Dictionary API translator.
 * Uses the free dict.youdao.com/jsonapi_s endpoint — no API key required.
 */
class YoudaoDict {
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
     * Lightweight: fetch only phonetics (US/UK IPA or pinyin) from Youdao dict.
     * Used by other translators (e.g. Bing) that don't provide real phonetics.
     */
    async fetchPhonetics(text: string, from: string): Promise<{ sPronunciation: string; tPronunciation: string }> {
        const empty = { sPronunciation: "", tPronunciation: "" };
        try {
            // zh-CN/zh-TW need le=auto for pinyin; other languages use LANG_TO_LE
            const le = (from === "zh-CN" || from === "zh-TW") ? "auto" : (LANG_TO_LE[from] || "auto");

            // Same case-variant logic as translate()
            const tryFetch = async (q: string) => {
                const data = await this.fetchDict(q, le);
                const simple = this.parseField(data.simple);
                const word = simple?.word?.[0];
                const rp = word?.["return-phrase"] || "";
                if (rp && text && !text.toLowerCase().includes(rp.toLowerCase()) && !rp.toLowerCase().includes(text.toLowerCase())) {
                    return null; // junk data
                }
                if (!word) return null;
                const phone = word.phone || "";
                return {
                    sPronunciation: word.usphone || word.ukphone || phone || "",
                    tPronunciation: word.ukphone || word.usphone || phone || "",
                };
            };

            // Try original case first
            let r = await tryFetch(text);
            if (r && (r.sPronunciation || r.tPronunciation)) return r;

            // Fallbacks: lowercase, capitalized
            const lower = text.toLowerCase();
            if (lower !== text) {
                r = await tryFetch(lower);
                if (r && (r.sPronunciation || r.tPronunciation)) return r;
            }
            const cap = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            if (cap !== text && cap !== lower) {
                r = await tryFetch(cap);
                if (r && (r.sPronunciation || r.tPronunciation)) return r;
            }

            return empty;
        } catch {
            return empty;
        }
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

            // zh-CN/zh-TW need le=auto; other languages use LANG_TO_LE
            const le = (from === "zh-CN" || from === "zh-TW") ? "auto" : (LANG_TO_LE[from] || "auto");

            // Try original text first (some words like "Node" only work with
            // proper case, others like "Capacitive" need lowercase, and
            // "node" (all lowercase) can return junk — so try variants).
            let data = await this.fetchDict(text, le);
            let result = this.parseResult(data, text);

            if (!result.mainMeaning) {
                // Collect case variants to try, skipping duplicates
                const variants: string[] = [];
                const lower = text.toLowerCase();
                if (lower !== text) variants.push(lower);
                const capitalized = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
                if (capitalized !== text && capitalized !== lower) variants.push(capitalized);

                for (const variant of variants) {
                    const variantData = await this.fetchDict(variant, le);
                    result = this.parseResult(variantData, text);
                    if (result.mainMeaning) break;
                }
            }

            // If phonetics are still missing (e.g. mainMeaning came from ec section
            // but simple.word had no phonetic data), try the dedicated phonetic
            // lookup which has its own case-variant fallback logic.
            if (!result.sPronunciation && !result.tPronunciation) {
                const phonetics = await this.fetchPhonetics(text, from);
                if (phonetics.sPronunciation) result.sPronunciation = phonetics.sPronunciation;
                if (phonetics.tPronunciation) result.tPronunciation = phonetics.tPronunciation;
            }

            // For en→zh: add Chinese target pinyin via second lookup.
            // targetPronunciation is separate from tPronunciation (source UK IPA)
            // so both can display correctly.
            if (to === "zh-CN" && result.mainMeaning) {
                const pinyin = await this.fetchPhonetics(result.mainMeaning, to);
                if (pinyin.sPronunciation) {
                    result.targetPronunciation = pinyin.sPronunciation;
                }
                // Preload Chinese target word audio for pronunciation button
                this.preloadAudio(result.mainMeaning, to);
            }

            // Preload TTS audio — if source language is "auto", use API-detected language
            const ttsLang = from === "auto" ? (data.le || "en") : from;
            this.preloadAudio(text, ttsLang);

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
            const phone = word.phone || ""; // pinyin / romaji for non-English entries
            const us = word.usphone || word.ukphone || phone || "";
            const uk = word.ukphone || word.usphone || phone || "";
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

        // ── Non-English dictionary sections (kc/ko, fc/fr, jc/ja) ──
        // These have nested tr[0].l.i structure unlike ec's flat tran field
        if (!result.mainMeaning) {
            for (const sectionKey of ["kc", "fc", "jc"]) {
                const section = this.parseField(data[sectionKey]);
                const sectionWord = section?.word;
                const sectionTrs = Array.isArray(sectionWord) ? sectionWord[0]?.trs : sectionWord?.trs;
                if (!sectionTrs) continue;
                for (const entry of sectionTrs) {
                    const tran = entry?.tran;
                    const nestedTran = entry?.tr?.[0]?.l?.i;
                    const meaningText = typeof tran === "string" ? tran
                        : Array.isArray(nestedTran) ? nestedTran.join("；")
                        : nestedTran || "";
                    if (!meaningText) continue;
                    const meanings = meaningText
                        .replace(/<[^>]+>/g, "")
                        .split(/[；;，,]/)
                        .map((s: string) => s.trim())
                        .filter((s: string) => s.length > 0 && s.length < 30);
                    if (meanings.length > 0) {
                        if (!result.mainMeaning) result.mainMeaning = meanings[0];
                        if (!result.detailedMeanings) result.detailedMeanings = [];
                        result.detailedMeanings.push({
                            pos: entry.pos || "",
                            meaning: meanings.join("，"),
                        });
                    }
                }
                if (result.mainMeaning) break;
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
        // dictvoice accepts raw language codes directly (en, zh-CN, ja, ko...)
        for (const [accent, type] of [["US", "2"], ["UK", "1"]]) {
            const key = text + "|" + accent;
            if (YoudaoDict._ttsCache.has(key)) continue;
            const ttsUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=${language}&type=${type}`;
            fetch(ttsUrl)
                .then((r) => r.blob())
                .then((blob) => YoudaoDict._ttsCache.set(key, URL.createObjectURL(blob)))
                .catch(() => {});
        }
    }

    /**
     * Pronounce given text — US (type=2) by default, UK (type=1) for sourceUK.
     */
    async pronounce(text: string, language: string, speed: PronunciationSpeed, pronouncing?: string) {
        void speed;
        this.stopPronounce();

        // If language is "auto", quickly detect via dict API
        let le = language;
        if (le === "auto") {
            try {
                const data = await this.fetchDict(text, le);
                le = data.le || "en";
            } catch { le = "en"; }
        }

        const accent = pronouncing === "sourceUK" ? "UK" : "US";
        const type = pronouncing === "sourceUK" ? "1" : "2";
        const key = text + "|" + accent;
        const directUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=${le}&type=${type}`;

        this.AUDIO.onerror = null;

        const tryPlay = async (url: string): Promise<void> => {
            this.AUDIO.src = url;
            await this.AUDIO.play();
        };

        try {
            // Try cached blob first, fall back to direct URL
            const cached = YoudaoDict._ttsCache.get(key);
            if (cached) {
                try { await tryPlay(cached); return; } catch { /* revoked, try direct */ }
            }
            await tryPlay(directUrl);
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
        for (const url of YoudaoDict._ttsCache.values()) {
            try { URL.revokeObjectURL(url); } catch {}
        }
        YoudaoDict._ttsCache.clear();
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

export default YoudaoDict;

// ── Youdao Fanyi (translate) API ──

/**
 * Language codes for Youdao official translate API (openapi.youdao.com).
 */
const FANYI_LANGUAGES: [string, string][] = [
    ["auto", "auto"],
    ["zh-CN", "zh-CHS"],
    ["zh-TW", "zh-CHT"],
    ["en", "en"],
    ["ja", "ja"],
    ["ko", "ko"],
    ["fr", "fr"],
    ["es", "es"],
    ["pt", "pt"],
    ["it", "it"],
    ["ru", "ru"],
    ["vi", "vi"],
    ["de", "de"],
    ["ar", "ar"],
    ["id", "id"],
    ["th", "th"],
    ["nl", "nl"],
    ["pl", "pl"],
    ["tr", "tr"],
];

/**
 * Youdao Official Translate API — uses openapi.youdao.com with appKey/appSecret.
 * Supports X→Y multi-language translation.
 * Requires API credentials from https://ai.youdao.com/
 */
class YoudaoTranslate {
    ENDPOINT = "https://openapi.youdao.com/api";

    appKey: string;
    appSecret: string;

    LAN_TO_CODE = new Map(FANYI_LANGUAGES);
    CODE_TO_LAN = new Map(FANYI_LANGUAGES.map(([lan, code]) => [code, lan]));

    constructor(appKey?: string, appSecret?: string) {
        this.appKey = appKey || "";
        this.appSecret = appSecret || "";
    }

    supportedLanguages(): Set<string> {
        return new Set(this.LAN_TO_CODE.keys());
    }

    async detect(text: string): Promise<string> {
        try {
            const result = await this.translate(text, "auto", "zh-CHS");
            return result.sourceLanguage || "en";
        } catch {
            return "en";
        }
    }

    async translate(text: string, from: string, to: string): Promise<TranslationResult> {
        if (!this.appKey || !this.appSecret) {
            console.warn("[YoudaoTranslate] No API keys configured. appKey:", !!this.appKey, "appSecret:", !!this.appSecret);
            return { originalText: text, mainMeaning: "" };
        }

        const toCode = this.LAN_TO_CODE.get(to) || to;
        const fromCode = from === "auto" ? "auto" : (this.LAN_TO_CODE.get(from) || from);
        const salt = String(Date.now());
        const curtime = String(Math.floor(Date.now() / 1000));

        // Official API v3 sign: md5(appKey + truncate(q) + salt + curtime + appSecret)
        const truncate = (q: string) => q.length > 20 ? q.slice(0, 10) + q.length + q.slice(-10) : q;
        const raw = this.appKey + truncate(text) + salt + curtime + this.appSecret;
        const sign = md5(raw);

        // Note: some accounts use different signType (v1/v2/v3)
        // Try v3 first, fall back to v2
        const body = new URLSearchParams({
            q: text,
            from: fromCode,
            to: toCode,
            appKey: this.appKey,
            salt,
            sign,
            curtime,
            signType: "v3",
            ext: "mp3",  // request TTS pronunciation when available
            voice: "0",
            strict: "true",
        }).toString();

        try {
            const response = (await axios({
                method: "POST",
                url: this.ENDPOINT,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data: body,
            })) as AxiosResponse<any>;

            return this.parseResult(response.data, text);
        } catch (e: any) {
            // Fallback: try without signType (v1)
            console.warn("[YoudaoTranslate] v3 failed, trying v1");
            const raw2 = this.appKey + truncate(text) + salt + this.appSecret;
            const sign2 = md5(raw2);
            const body2 = new URLSearchParams({
                q: text,
                from: fromCode,
                to: toCode,
                appKey: this.appKey,
                salt,
                sign: sign2,
            }).toString();

            const response = (await axios({
                method: "POST",
                url: this.ENDPOINT,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data: body2,
            })) as AxiosResponse<any>;

            return this.parseResult(response.data, text);
        }
    }

    parseResult(data: any, originalText: string): TranslationResult {
        const result: TranslationResult = {
            originalText: originalText,
            mainMeaning: "",
        };

        if (data.errorCode !== "0") {
            console.warn("[YoudaoTranslate] API error:", data.errorCode, data.msg || data);
            return result;
        }
        console.log("[YoudaoTranslate] API response:", JSON.stringify(data).slice(0, 300));

        // Parse translation result
        if (data.translation?.length > 0) {
            result.mainMeaning = data.translation[0];
        }

        // Parse basic dict if available
        if (data.basic) {
            if (data.basic.phonetic) {
                result.sPronunciation = data.basic.phonetic;
            }
            if (data.basic["uk-phonetic"]) {
                result.tPronunciation = data.basic["uk-phonetic"];
            }
            if (data.basic["us-phonetic"]) {
                result.sPronunciation = data.basic["us-phonetic"];
            }
            if (data.basic.explains?.length > 0) {
                result.detailedMeanings = data.basic.explains.map((e: string) => {
                    const parts = e.split(/\.\s+/);
                    return { pos: parts[0] || "", meaning: parts.slice(1).join(". ") || e };
                });
            }
        }

        // Detect source language from response
        if (data.l) {
            const detected = data.l.split("2")[0];
            result.sourceLanguage = this.CODE_TO_LAN.get(detected) || detected;
        }

        return result;
    }

    pronounce(_text: string, _language: string, _speed: PronunciationSpeed, _pronouncing?: string): Promise<void> {
        return Promise.resolve();
    }
    stopPronounce(): void {}
}

export { YoudaoTranslate };
