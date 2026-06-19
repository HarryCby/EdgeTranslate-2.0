import {
    PronunciationSpeed,
    TranslationResult,
} from "../types";
import BaiduTranslator from "./baidu";
import BingTranslator from "./bing";
import DeepLTranslator from "./deepl";
import GoogleTranslator from "./google";
import TencentTranslator from "./tencent";
import YoudaoDict, { YoudaoTranslate } from "./youdao";

export type HybridSupportedTranslators =
    | "BaiduTranslate"
    | "BingTranslate"
    | "DeepLTranslate"
    | "GoogleTranslate"
    | "TencentTranslate"
    | "YoudaoDict"        // 有道词典 (dict API)
    | "YoudaoTranslate";   // 有道翻译 (fanyi API)

export type HybridConfig = {
    selections: Selections;
    translators: HybridSupportedTranslators[]; // a collection of used translators which is generated based on selections. The generating process is in options.js.
    pronunciationSource: HybridSupportedTranslators; // translator for audio pronunciation (TTS). Only YoudaoDict has real TTS; others will return empty/fail gracefully.
};
export type Selections = Record<keyof TranslationResult, HybridSupportedTranslators>;

class HybridTranslator {
    channel: any; // communication channel.
    /**
     * Hybrid translator config.
     */
    CONFIG: HybridConfig = {
        selections: {} as Selections,
        translators: [],
        pronunciationSource: "YoudaoDict",
    };
    REAL_TRANSLATORS!: {
        BaiduTranslate: BaiduTranslator;
        BingTranslate: BingTranslator;
        GoogleTranslate: GoogleTranslator;
        TencentTranslate: TencentTranslator;
        YoudaoDict: YoudaoDict;
        YoudaoTranslate: YoudaoTranslate;
        DeepLTranslate: DeepLTranslator;
    };
    MAIN_TRANSLATOR: HybridSupportedTranslators = "GoogleTranslate";
    /** Per-translator timeout (ms). When a translator hangs (e.g. Google
     *  behind GFW), the request is dropped and treated as a failure. */
    static TRANSLATOR_TIMEOUT = 10000;

    constructor(
        config: HybridConfig,
        channel: any,
        googleConfig?: { proxyUrl: string },
        tencentConfig?: { secretId: string; secretKey: string },
        baiduConfig?: { appId: string; appKey: string },
        youdaoConfig?: { appKey: string; appSecret: string }
    ) {
        this.channel = channel;

        /**
         * Real supported translators.
         */
        this.REAL_TRANSLATORS = {
            BaiduTranslate: new BaiduTranslator(
                baiduConfig?.appId || "",
                baiduConfig?.appKey || ""
            ),
            BingTranslate: new BingTranslator(),
            GoogleTranslate: new GoogleTranslator(googleConfig?.proxyUrl),
            TencentTranslate: new TencentTranslator(
                tencentConfig?.secretId || "",
                tencentConfig?.secretKey || ""
            ),
            YoudaoDict: new YoudaoDict(
                youdaoConfig?.appKey || "",
                youdaoConfig?.appSecret || ""
            ),
            YoudaoTranslate: new YoudaoTranslate(
                youdaoConfig?.appKey || "",
                youdaoConfig?.appSecret || ""
            ),
            DeepLTranslate: null as unknown as DeepLTranslator,
        };

        /**
         * DeepL translator needs help from other translators and we choose Google for now.
         */
        this.REAL_TRANSLATORS.DeepLTranslate = new DeepLTranslator(
            this.REAL_TRANSLATORS.BingTranslate,
            this.REAL_TRANSLATORS.BingTranslate
        );

        this.useConfig(config);
    }

    /**
     * Update config.
     *
     * @param {Object} config to use.
     */
    useConfig(config: HybridConfig) {
        /**
         * Validate config.
         */
        if (!config || !config.translators || !config.selections) {
            console.error("Invalid config for HybridTranslator!");
            return;
        }

        // Default pronunciationSource if not set (backward compat with old configs)
        if (!config.pronunciationSource) {
            config.pronunciationSource = "YoudaoDict";
        }

        this.CONFIG = config;
        this.MAIN_TRANSLATOR = config.selections.mainMeaning;
    }

    /**
     * Get translators that support given source language and target language.
     *
     * @param from source language
     * @param to target language
     *
     * @returns available translators
     */
    /**
     * Display order for translators in dropdowns.
     */
    static DISPLAY_ORDER: HybridSupportedTranslators[] = [
        "BingTranslate",
        "TencentTranslate",
        "BaiduTranslate",
        "YoudaoDict",
        "YoudaoTranslate",
        "GoogleTranslate",
        "DeepLTranslate",
    ];

    getAvailableTranslatorsFor(from: string, to: string) {
        const translators: HybridSupportedTranslators[] = [];
        let translator: HybridSupportedTranslators;
        for (translator in this.REAL_TRANSLATORS) {
            const languages = this.REAL_TRANSLATORS[translator].supportedLanguages();
            if (languages.has(from) && languages.has(to)) {
                translators.push(translator);
            }
        }
        // Sort by DISPLAY_ORDER, fallback to alphabetical
        const order = HybridTranslator.DISPLAY_ORDER;
        return translators.sort((a, b) => {
            const ai = order.indexOf(a), bi = order.indexOf(b);
            if (ai >= 0 && bi >= 0) return ai - bi;
            if (ai >= 0) return -1;
            if (bi >= 0) return 1;
            return a.localeCompare(b);
        });
    }

    /**
     * Update hybrid translator config when language setting changed.
     *
     * @param from source language
     * @param to target language
     *
     * @returns new config
     */
    updateConfigFor(from: string, to: string) {
        const newConfig: HybridConfig = {
            translators: [],
            selections: {} as Selections,
            pronunciationSource: this.CONFIG.pronunciationSource || "YoudaoDict",
        };
        const translatorsSet = new Set<HybridSupportedTranslators>();

        // Get translators that support new language setting.
        const availableTranslators = this.getAvailableTranslatorsFor(from, to);

        // Replace translators that don't support new language setting with a default translator.
        const defaultTranslator = availableTranslators[0];

        // Use this set to check if a translator in the old config should be replaced.
        const availableTranslatorSet = new Set(availableTranslators);

        let item: keyof Selections;
        for (item in this.CONFIG.selections) {
            let newTranslator,
                oldTranslator = this.CONFIG.selections[item];

            if (availableTranslatorSet.has(oldTranslator)) {
                newConfig.selections[item] = oldTranslator;
                newTranslator = oldTranslator;
            } else {
                newConfig.selections[item] = defaultTranslator;
                newTranslator = defaultTranslator;
            }

            translatorsSet.add(newTranslator);
        }

        // Update used translator set.
        newConfig.translators = Array.from(translatorsSet);

        // Provide new config.
        return newConfig;
    }

    /**
     * Detect language of given text.
     *
     * @param text text
     *
     * @returns Promise of language of given text
     */
    async detect(text: string) {
        return this.REAL_TRANSLATORS[this.MAIN_TRANSLATOR].detect(text);
    }

    // Cache: raw translate responses keyed by text, for progressive enrichment
    _quickResults: Map<string, TranslationResult> = new Map();

    /**
     * Try to fill missing source phonetics by calling fetchPhonetics on the
     * pronunciation source translator (YoudaoDict).  This is a belt-and-suspenders
     * fallback that does NOT depend on selections config — it works even when the
     * user's saved selections have stale/wrong values (e.g. from the old options
     * bug that overwrote sPronunciation/tPronunciation on main-translator change).
     */
    private async _fillMissingPhonetics(
        translation: TranslationResult,
        text: string,
        from: string,
        to: string,
        results: Map<HybridSupportedTranslators, TranslationResult>
    ) {
        // Source phonetics (US/UK IPA)
        // NOTE: only check sPronunciation here — tPronunciation may already be
        // filled with transliteration (pinyin/romaji) from a quick translate
        // result, which would make `!translation.tPronunciation` false and
        // skip the fetchPhonetics fallback entirely.
        if (!translation.sPronunciation) {
            const source = this.CONFIG.pronunciationSource || "YoudaoDict";
            const t = this.REAL_TRANSLATORS[source] as any;
            if (typeof t.fetchPhonetics === "function") {
                try {
                    const p = await t.fetchPhonetics(text, from);
                    if (p.sPronunciation) translation.sPronunciation = p.sPronunciation;
                    if (p.tPronunciation) translation.tPronunciation = p.tPronunciation;
                } catch {}
            }
        }
        // Target pronunciation (pinyin) — derived from the mainMeaning translator's result
        if (!translation.targetPronunciation && translation.mainMeaning && to === "zh-CN") {
            const mainSource = results.get(this.CONFIG.selections["mainMeaning"] as HybridSupportedTranslators);
            if (mainSource?.targetPronunciation) {
                translation.targetPronunciation = mainSource.targetPronunciation;
            }
            if (!translation.targetPronunciation) {
                const source = this.CONFIG.pronunciationSource || "YoudaoDict";
                const t = this.REAL_TRANSLATORS[source] as any;
                if (typeof t.fetchPhonetics === "function") {
                    try {
                        const p = await t.fetchPhonetics(translation.mainMeaning, to);
                        if (p.sPronunciation) translation.targetPronunciation = p.sPronunciation;
                    } catch {}
                }
            }
        }
    }

    /**
     * Helper: wrap a translator promise so it rejects if it doesn't settle
     * within TRANSLATOR_TIMEOUT ms.  When the outer promise settles (resolve
     * or reject), the original promise's eventual .then/.catch callbacks
     * become no-ops (cannot settle an already-settled promise), so stale
     * callbacks never reach the caller's chain.
     */
    private async _withTimeout<T>(promise: Promise<T>, name: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error(`[Hybrid] ${name} timed out after ${HybridTranslator.TRANSLATOR_TIMEOUT}ms`)),
                HybridTranslator.TRANSLATOR_TIMEOUT
            );
            promise.then(
                (v) => { clearTimeout(timer); resolve(v); },
                (e) => { clearTimeout(timer); reject(e); }
            );
        });
    }

    /**
     * Quick translate — basic mainMeaning from all translators, fast.
     * For Bing this skips lookup API; for others it's the same as translate().
     */
    async translateQuick(text: string, from: string, to: string) {
        this._quickResults.clear();
        const requests: Promise<[HybridSupportedTranslators, TranslationResult] | null>[] = [];
        const errors: string[] = [];
        for (const name of this.CONFIG.translators) {
            const t = this.REAL_TRANSLATORS[name] as any;
            const rawPromise = typeof t.translateQuick === "function" ? t.translateQuick(text, from, to) : t.translate(text, from, to);
            const p = this._withTimeout<TranslationResult>(rawPromise, name)
                .then((r: TranslationResult) => { this._quickResults.set(name, r); return [name, r] as [HybridSupportedTranslators, TranslationResult]; })
                .catch((err: any) => { const msg = err?.errorMsg || err?.message || String(err); console.warn("[Hybrid] " + name + " failed:", msg); errors.push(name + ": " + msg); return null; });
            requests.push(p);
        }
        const allResults = await Promise.all(requests);
        const merged = this._mergeResults(allResults);
        if (errors.length > 0) merged.errors = errors;
        // Fill missing phonetics regardless of selections config
        const results = new Map(allResults.filter(Boolean) as [HybridSupportedTranslators, TranslationResult][]);
        await this._fillMissingPhonetics(merged, text, from, to, results);
        return merged;
    }

    /**
     * Enrich with details — only for translators that support it (Bing).
     */
    async enrich(text: string, from: string, to: string, _quickResult: TranslationResult) {
        const requests: Promise<[HybridSupportedTranslators, TranslationResult] | null>[] = [];
        const errors: string[] = [];
        for (const name of this.CONFIG.translators) {
            const t = this.REAL_TRANSLATORS[name] as any;
            if (typeof t.enrich === "function") {
                const base = this._quickResults.get(name);
                const rawPromise = base ? t.enrich(text, from, to, base) : t.translate(text, from, to);
                const p = this._withTimeout<TranslationResult>(rawPromise, name)
                    .then((r: TranslationResult) => [name, r] as [HybridSupportedTranslators, TranslationResult])
                    .catch((err: any) => { const msg = err?.errorMsg || err?.message || String(err); console.warn("[Hybrid] enrich " + name + " failed:", msg); errors.push(name + ": " + msg); return null; });
                requests.push(p);
            }
        }
        const enriched = (await Promise.all(requests)).filter(Boolean) as [HybridSupportedTranslators, TranslationResult][];

        // Merge enriched results with existing quick results
        const merged = new Map<string, TranslationResult>();
        for (const [name, result] of this._quickResults) merged.set(name, result);
        for (const [name, result] of enriched) merged.set(name, result);

        const result = this._mergeResults(Array.from(merged.entries()) as [HybridSupportedTranslators, TranslationResult][]);
        if (errors.length > 0) result.errors = (result.errors || []).concat(errors);
        // Fill missing phonetics regardless of selections config
        await this._fillMissingPhonetics(result, text, from, to, merged as Map<HybridSupportedTranslators, TranslationResult>);
        return result;
    }

    _mergeResults(allResults: ([HybridSupportedTranslators, TranslationResult] | null)[]) {
        const valid = allResults.filter(Boolean) as [HybridSupportedTranslators, TranslationResult][];
        const results = new Map(valid);
        const translation: TranslationResult = { originalText: "", mainMeaning: "" };
        let item: keyof Selections;
        for (item in this.CONFIG.selections) {
            try {
                const selectedTranslator = this.CONFIG.selections[item];
                const r = results.get(selectedTranslator);
                if (r) {
                    (translation as any)[item] = r[item];
                }
            } catch (error) {
                console.log(`${item} ${this.CONFIG.selections[item]}`);
                console.log(error);
            }
        }
        // ── mainMeaning / originalText fallbacks ──
        // When the configured main translator fails (e.g. Google behind GFW),
        // try every other translator's result so the user still gets output.
        if (!translation.mainMeaning) {
            for (const [, r] of results) {
                if (r.mainMeaning) {
                    translation.mainMeaning = r.mainMeaning;
                    break;
                }
            }
        }
        if (!translation.originalText) {
            for (const [, r] of results) {
                if (r.originalText) {
                    translation.originalText = r.originalText;
                    break;
                }
            }
        }
        // ── Pronunciation fallbacks ──
        // If the configured translator for a pronunciation field didn't produce
        // data (e.g. API failure, unsupported language, no word data), try
        // every other translator's result — Bing's enrich, for example, fetches
        // phonetics from Youdao's fetchPhonetics internally, so its result may
        // have the data even when YoudaoDict's own translate call failed.
        const fallbackPronunciation = (field: "sPronunciation" | "tPronunciation" | "targetPronunciation") => {
            if (translation[field]) return;
            for (const [, r] of results) {
                if (r[field]) {
                    (translation as any)[field] = r[field];
                    return;
                }
            }
        };
        // targetPronunciation is the pinyin of the TRANSLATED word, so it
        // should logically follow the same translator that provides mainMeaning.
        // Try that first before scanning all results.
        if (!translation.targetPronunciation) {
            const mainSource = results.get(this.CONFIG.selections["mainMeaning"] as HybridSupportedTranslators);
            if (mainSource?.targetPronunciation) {
                translation.targetPronunciation = mainSource.targetPronunciation;
            }
        }
        fallbackPronunciation("sPronunciation");
        fallbackPronunciation("tPronunciation");
        fallbackPronunciation("targetPronunciation");

        return translation;
    }

    /**
     * Hybrid translate — full pipeline.
     */
    async translate(text: string, from: string, to: string) {
        const errors: string[] = [];
        const allResults = await Promise.all(
            this.CONFIG.translators.map((name) => {
                const t = this.REAL_TRANSLATORS[name] as any;
                return this._withTimeout<TranslationResult>(t.translate(text, from, to), name)
                    .then((r) => [name, r] as [HybridSupportedTranslators, TranslationResult])
                    .catch((err) => {
                        const msg = err?.errorMsg || err?.message || String(err);
                        console.warn("[Hybrid] " + name + " failed:", msg);
                        errors.push(name + ": " + msg);
                        return null;
                    });
            })
        );
        const result = this._mergeResults(allResults);
        if (errors.length > 0) result.errors = errors;
        const results = new Map(allResults.filter(Boolean) as [HybridSupportedTranslators, TranslationResult][]);
        await this._fillMissingPhonetics(result, text, from, to, results);
        return result;
    }

    /**
     * Pronounce given text.
     *
     * @param text text to pronounce
     * @param language language of text
     * @param speed "fast" or "slow"
     *
     * @returns pronounce finished
     */
    async pronounce(text: string, language: string, speed: PronunciationSpeed) {
        const source = this.CONFIG.pronunciationSource || "YoudaoDict";
        return this.REAL_TRANSLATORS[source].pronounce(text, language, speed);
    }

    /**
     * Pause pronounce.
     */
    async stopPronounce() {
        const source = this.CONFIG.pronunciationSource || "YoudaoDict";
        this.REAL_TRANSLATORS[source].stopPronounce();
    }
}

export default HybridTranslator;
