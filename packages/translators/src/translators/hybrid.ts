import {
    Definition,
    DetailedMeaning,
    Example,
    PronunciationSpeed,
    TranslationResult,
} from "../types";
import BaiduTranslator from "./baidu";
import BingTranslator from "./bing";
import DeepLTranslator from "./deepl";
import GoogleTranslator from "./google";
import TencentTranslator from "./tencent";
import YoudaoTranslator from "./youdao";

export type HybridSupportedTranslators =
    | "BaiduTranslate"
    | "BingTranslate"
    | "DeepLTranslate"
    | "GoogleTranslate"
    | "TencentTranslate"
    | "YoudaoTranslate";

export type HybridConfig = {
    selections: Selections;
    translators: HybridSupportedTranslators[]; // a collection of used translators which is generated based on selections. The generating process is in options.js.
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
    };
    REAL_TRANSLATORS!: {
        BaiduTranslate: BaiduTranslator;
        BingTranslate: BingTranslator;
        GoogleTranslate: GoogleTranslator;
        TencentTranslate: TencentTranslator;
        YoudaoTranslate: YoudaoTranslator;
        DeepLTranslate: DeepLTranslator;
    };
    MAIN_TRANSLATOR: HybridSupportedTranslators = "GoogleTranslate";

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
            YoudaoTranslate: new YoudaoTranslator(
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
        const newConfig: HybridConfig = { translators: [], selections: {} as Selections };
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
     * Quick translate — basic mainMeaning from all translators, fast.
     * For Bing this skips lookup API; for others it's the same as translate().
     */
    async translateQuick(text: string, from: string, to: string) {
        this._quickResults.clear();
        const requests: Promise<[HybridSupportedTranslators, TranslationResult] | null>[] = [];
        for (const name of this.CONFIG.translators) {
            const t = this.REAL_TRANSLATORS[name] as any;
            const p = (typeof t.translateQuick === "function" ? t.translateQuick(text, from, to) : t.translate(text, from, to))
                .then((r: TranslationResult) => { this._quickResults.set(name, r); return [name, r] as [HybridSupportedTranslators, TranslationResult]; })
                .catch((err: any) => { console.warn("[Hybrid] " + name + " failed:", err?.errorMsg || err?.message || err); return null; });
            requests.push(p);
        }
        return this._mergeResults(await Promise.all(requests));
    }

    /**
     * Enrich with details — only for translators that support it (Bing).
     */
    async enrich(text: string, from: string, to: string, _quickResult: TranslationResult) {
        const requests: Promise<[HybridSupportedTranslators, TranslationResult] | null>[] = [];
        for (const name of this.CONFIG.translators) {
            const t = this.REAL_TRANSLATORS[name] as any;
            if (typeof t.enrich === "function") {
                const base = this._quickResults.get(name);
                const p = (base ? t.enrich(text, from, to, base) : t.translate(text, from, to))
                    .then((r: TranslationResult) => [name, r] as [HybridSupportedTranslators, TranslationResult])
                    .catch((err: any) => { console.warn("[Hybrid] enrich " + name + " failed:", err?.errorMsg || err?.message || err); return null; });
                requests.push(p);
            }
        }
        const enriched = (await Promise.all(requests)).filter(Boolean) as [HybridSupportedTranslators, TranslationResult][];

        // Merge enriched results with existing quick results
        const merged = new Map<string, TranslationResult>();
        for (const [name, result] of this._quickResults) merged.set(name, result);
        for (const [name, result] of enriched) merged.set(name, result);

        return this._mergeResults(Array.from(merged.entries()) as [HybridSupportedTranslators, TranslationResult][]);
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
                    translation[item] = r[item] as string & DetailedMeaning[] & Definition[] & Example[];
                }
            } catch (error) {
                console.log(`${item} ${this.CONFIG.selections[item]}`);
                console.log(error);
            }
        }
        return translation;
    }

    /**
     * Hybrid translate — full pipeline.
     */
    async translate(text: string, from: string, to: string) {
        return this._mergeResults(
            await Promise.all(
                this.CONFIG.translators.map((name) =>
                    this.REAL_TRANSLATORS[name]
                        .translate(text, from, to)
                        .then((r) => [name, r] as [HybridSupportedTranslators, TranslationResult])
                        .catch((err) => {
                            console.warn("[Hybrid] " + name + " failed:", err?.errorMsg || err?.message || err);
                            return null;
                        })
                )
            )
        );
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
        return this.REAL_TRANSLATORS[this.MAIN_TRANSLATOR].pronounce(text, language, speed);
    }

    /**
     * Pause pronounce.
     */
    async stopPronounce() {
        this.REAL_TRANSLATORS[this.MAIN_TRANSLATOR].stopPronounce();
    }
}

export default HybridTranslator;
