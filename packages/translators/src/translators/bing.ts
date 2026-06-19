import type { AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "../axios";
import { PronunciationSpeed, TranslationResult } from "../types";
import YoudaoTranslator from "./youdao";

/**
 * Supported languages.
 */
const LANGUAGES: [string, string][] = [
    ["auto", "auto-detect"],
    ["ar", "ar"],
    ["ga", "ga"],
    ["et", "et"],
    ["or", "or"],
    ["bg", "bg"],
    ["is", "is"],
    ["pl", "pl"],
    ["bs", "bs-Latn"],
    ["fa", "fa"],
    ["prs", "prs"],
    ["da", "da"],
    ["de", "de"],
    ["ru", "ru"],
    ["fr", "fr"],
    ["zh-TW", "zh-Hant"],
    ["fil", "fil"],
    ["fj", "fj"],
    ["fi", "fi"],
    ["gu", "gu"],
    ["kk", "kk"],
    ["ht", "ht"],
    ["ko", "ko"],
    ["nl", "nl"],
    ["ca", "ca"],
    ["zh-CN", "zh-Hans"],
    ["cs", "cs"],
    ["kn", "kn"],
    ["otq", "otq"],
    ["tlh", "tlh"],
    ["hr", "hr"],
    ["lv", "lv"],
    ["lt", "lt"],
    ["ro", "ro"],
    ["mg", "mg"],
    ["mt", "mt"],
    ["mr", "mr"],
    ["ml", "ml"],
    ["ms", "ms"],
    ["mi", "mi"],
    ["bn", "bn-BD"],
    ["hmn", "mww"],
    ["af", "af"],
    ["pa", "pa"],
    ["pt", "pt"],
    ["ps", "ps"],
    ["ja", "ja"],
    ["sv", "sv"],
    ["sm", "sm"],
    ["sr-Latn", "sr-Latn"],
    ["sr-Cyrl", "sr-Cyrl"],
    ["no", "nb"],
    ["sk", "sk"],
    ["sl", "sl"],
    ["sw", "sw"],
    ["ty", "ty"],
    ["te", "te"],
    ["ta", "ta"],
    ["th", "th"],
    ["to", "to"],
    ["tr", "tr"],
    ["cy", "cy"],
    ["ur", "ur"],
    ["uk", "uk"],
    ["es", "es"],
    ["he", "iw"],
    ["el", "el"],
    ["hu", "hu"],
    ["it", "it"],
    ["hi", "hi"],
    ["id", "id"],
    ["en", "en"],
    ["yua", "yua"],
    ["yue", "yua"],
    ["vi", "vi"],
    ["ku", "ku"],
    ["kmr", "kmr"],
];

/**
 * Text readers.
 */
const READERS = {
    ar: ["ar-SA", "Male", "ar-SA-Naayf"],
    bg: ["bg-BG", "Male", "bg-BG-Ivan"],
    ca: ["ca-ES", "Female", "ca-ES-HerenaRUS"],
    cs: ["cs-CZ", "Male", "cs-CZ-Jakub"],
    da: ["da-DK", "Female", "da-DK-HelleRUS"],
    de: ["de-DE", "Female", "de-DE-Hedda"],
    el: ["el-GR", "Male", "el-GR-Stefanos"],
    en: ["en-US", "Female", "en-US-JessaRUS"],
    es: ["es-ES", "Female", "es-ES-Laura-Apollo"],
    fi: ["fi-FI", "Female", "fi-FI-HeidiRUS"],
    fr: ["fr-FR", "Female", "fr-FR-Julie-Apollo"],
    he: ["he-IL", "Male", "he-IL-Asaf"],
    hi: ["hi-IN", "Female", "hi-IN-Kalpana-Apollo"],
    hr: ["hr-HR", "Male", "hr-HR-Matej"],
    hu: ["hu-HU", "Male", "hu-HU-Szabolcs"],
    id: ["id-ID", "Male", "id-ID-Andika"],
    it: ["it-IT", "Male", "it-IT-Cosimo-Apollo"],
    ja: ["ja-JP", "Female", "ja-JP-Ayumi-Apollo"],
    ko: ["ko-KR", "Female", "ko-KR-HeamiRUS"],
    ms: ["ms-MY", "Male", "ms-MY-Rizwan"],
    nl: ["nl-NL", "Female", "nl-NL-HannaRUS"],
    nb: ["nb-NO", "Female", "nb-NO-HuldaRUS"],
    no: ["nb-NO", "Female", "nb-NO-HuldaRUS"],
    pl: ["pl-PL", "Female", "pl-PL-PaulinaRUS"],
    pt: ["pt-PT", "Female", "pt-PT-HeliaRUS"],
    ro: ["ro-RO", "Male", "ro-RO-Andrei"],
    ru: ["ru-RU", "Female", "ru-RU-Irina-Apollo"],
    sk: ["sk-SK", "Male", "sk-SK-Filip"],
    sl: ["sl-SL", "Male", "sl-SI-Lado"],
    sv: ["sv-SE", "Female", "sv-SE-HedvigRUS"],
    ta: ["ta-IN", "Female", "ta-IN-Valluvar"],
    te: ["te-IN", "Male", "te-IN-Chitra"],
    th: ["th-TH", "Male", "th-TH-Pattara"],
    tr: ["tr-TR", "Female", "tr-TR-SedaRUS"],
    vi: ["vi-VN", "Male", "vi-VN-An"],
    "zh-Hans": ["zh-CN", "Female", "zh-CN-HuihuiRUS"],
    "zh-Hant": ["zh-CN", "Female", "zh-CN-HuihuiRUS"],
    yue: ["zh-HK", "Female", "zh-HK-TracyRUS"],
};

/**
 * TTS language code.
 */
const TTS_LAN_CODE = {
    ar: "ar-EG",
    ca: "ca-ES",
    da: "da-DK",
    de: "de-DE",
    en: "en-US",
    es: "es-ES",
    fi: "fi-FI",
    fr: "fr-FR",
    hi: "hi-IN",
    it: "it-IT",
    ja: "ja-JP",
    ko: "ko-KR",
    nb: "nb-NO",
    nl: "nl-NL",
    pl: "pl-PL",
    pt: "pt-PT",
    ru: "ru-RU",
    sv: "sv-SE",
    th: "th-TH",
    "zh-Hans": "zh-CN",
    "zh-Hant": "zh-HK",
    yue: "zh-HK",
    gu: "gu-IN",
    mr: "mr-IN",
    ta: "ta-IN",
    te: "te-IN",
    tr: "tr-TR",
};

/**
 * Bing translator interface.
 */
class BingTranslator {
    /**
     * Basic request parameters.
     */
    IG = "";
    IID: string | null = "";
    token = "";
    key = "";

    /**
     * Whether we have initiated tokens.
     */
    tokensInitiated = false;

    /**
     * TTS auth info.
     */
    TTS_AUTH = { region: "", token: "" };

    /**
     * Request count.
     */
    count = 0;

    HTMLParser = new DOMParser();

    /**
     * Max retry times.
     */
    MAX_RETRY = 1;

    /**
     * Translate API host.
     */
    HOST = "https://cn.bing.com/";

    /**
     * Translate API home page.
     */
    HOME_PAGE = "https://cn.bing.com/translator";

    /**
     * Request headers.
     */
    HEADERS = {
        accept: "*/*",
        "accept-language": "zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7",
        "content-type": "application/x-www-form-urlencoded",
    };

    /**
     * Language to translator language code.
     */
    LAN_TO_CODE = new Map(LANGUAGES);

    /**
     * Translator language code to language.
     */
    CODE_TO_LAN = new Map(LANGUAGES.map(([lan, code]) => [code, lan]));

    /**
     * Youdao dict for phonetics (US/UK IPA + pinyin).
     * Bing only provides transliteration — not real phonetics.
     */
    _youdao = new YoudaoTranslator();

    /**
     * Audio instance.
     */
    AUDIO = new Audio();

    /**
     * Get IG and IID for urls.
     *
     * @returns IG and IID Promise
     */
    async updateTokens() {
        const response = (await axios.get(this.HOME_PAGE)) as AxiosResponse<any>;

        /**
         * Bing redirects user requests based on user region. For example, if we are in China and request
         * www.bing.com, we will be redirected to cn.bing.com. This causes translating error because IG and IID
         * for one region are not usable for another. Therefore, we need to update HOST, HOME_PAGE, IG and IID
         * whenever a redirection happened.
         *
         * If the requested host is different from the original host, which means there was a redirection,
         * update HOST and HOME_PAGE with the redirecting host.
         */
        const responseHost = /(https:\/\/.*\.bing\.com\/).*/g.exec(response.request.responseURL);
        if (responseHost && responseHost[1] != this.HOST) {
            this.HOST = responseHost[1];
            this.HOME_PAGE = `${this.HOST}translator`;
        }

        this.IG = response.data.match(/IG:"([A-Za-z0-9]+)"/)[1];

        [, this.key, this.token] = response.data.match(
            /var params_AbusePreventionHelper\s*=\s*\[([0-9]+),\s*"([^"]+)",[^\]]*\];/
        );

        // Extract IID from the data-iid attribute on #rich_tta element.
        // The new Bing Translator page uses format like "translator.5023".
        const html = this.HTMLParser.parseFromString(response.data, "text/html");
        this.IID = html.getElementById("rich_tta")?.getAttribute("data-iid") || "";

        // Reset request count.
        this.count = 0;
    }

    /**
     * Parse translate interface result.
     *
     * @param result translate result
     * @param extras extra data
     *
     * @returns Parsed result
     */
    parseTranslateResult(result: any, extras: TranslationResult) {
        const parsed = extras || new Object();

        try {
            const translations = result[0].translations;
            parsed.mainMeaning = translations[0].text;
            if (translations[0].transliteration) {
                parsed.tPronunciation = translations[0].transliteration.text || translations[0].transliteration;
            }
        } catch (error) {
            console.warn("[Bing] parseTranslateResult failed:", error);
        }

        return parsed;
    }

    /**
     * Parse the lookup interface result.
     *
     * @param result lookup result
     * @param extras extra data
     *
     * @returns Parsed result
     */
    parseLookupResult(result: any, extras: TranslationResult) {
        const parsed = extras || new Object();

        try {
            const root = result[0];
            if (!root) return parsed;

            parsed.originalText = root.displaySource || parsed.originalText;

            const translations = root.translations;
            if (!translations || !translations.length) return parsed;

            parsed.mainMeaning = translations[0].displayTarget || parsed.mainMeaning;
            if (translations[0].transliteration) {
                parsed.tPronunciation = translations[0].transliteration.text || translations[0].transliteration;
            }

            const detailedMeanings = [];
            for (const item of translations) {
                if (!item.posTag && !item.displayTarget) continue;
                const synonyms = [];
                if (item.backTranslations) {
                    for (const back of item.backTranslations) {
                        if (back.displayText) synonyms.push(back.displayText);
                    }
                }
                detailedMeanings.push({
                    pos: item.posTag,
                    meaning: item.displayTarget,
                    synonyms,
                });
            }

            parsed.detailedMeanings = detailedMeanings;
        } catch (error) {
            console.warn("[Bing] parseLookupResult failed:", error);
        }

        return parsed;
    }

    /**
     * Parse example response.
     *
     * @param result example response
     * @param extras extra data
     *
     * @returns parse result
     */
    parseExampleResult(result: any, extras: TranslationResult) {
        const parsed = extras || new Object();

        try {
            if (result[0] && result[0].examples) {
                parsed.examples = result[0].examples.map(
                    (example: {
                        sourcePrefix: string;
                        sourceTerm: string;
                        sourceSuffix: string;
                        targetPrefix: string;
                        targetTerm: string;
                        targetSuffix: string;
                    }) => ({
                        source: `${example.sourcePrefix}<b>${example.sourceTerm}</b>${example.sourceSuffix}`,
                        target: `${example.targetPrefix}<b>${example.targetTerm}</b>${example.targetSuffix}`,
                    })
                );
            }
        } catch (error) {
            console.warn("[Bing] parseExampleResult failed:", error);
        }

        return parsed;
    }

    /**
     * Get TTS auth token.
     *
     * @returns request finished Promise
     */
    async updateTTSAuth() {
        const constructParams = () => {
            return {
                method: "POST",
                baseURL: this.HOST,
                url: `tfetspktok?isVertical=1&&IG=${this.IG}&IID=${
                    this.IID
                }&SFX=${this.count.toString()}`,
                headers: this.HEADERS,
                data: `&token=${encodeURIComponent(this.token)}&key=${encodeURIComponent(
                    this.key
                )}`,
            } as AxiosRequestConfig;
        };

        const response = await this.request(constructParams, []);
        this.TTS_AUTH.region = response.region;
        this.TTS_AUTH.token = response.token;
    }

    /**
     * Generate TTS request data.
     *
     * @param text text to pronounce
     * @param language language of text
     * @param speed pronouncing speed, "fast" or "slow"
     *
     * @returns TTS request data
     */
    generateTTSData(text: string, language: string, speed: PronunciationSpeed) {
        const lanCode = this.LAN_TO_CODE.get(language)! as keyof typeof READERS &
            keyof typeof TTS_LAN_CODE;
        const reader = READERS[lanCode];
        const ttsLanCode = TTS_LAN_CODE[lanCode];
        const speedValue = speed === "fast" ? "-10.00%" : "-30.00%";
        return `<speak version='1.0' xml:lang='${ttsLanCode}'><voice xml:lang='${ttsLanCode}' xml:gender='${reader[1]}' name='${reader[2]}'><prosody rate='${speedValue}'>${text}</prosody></voice></speak>`;
    }

    /**
     * Transform binary data into Base64 encoding.
     *
     * @param buffer array buffer with audio data
     *
     * @returns Base64 form of binary data in buffer
     */
    arrayBufferToBase64(buffer: Iterable<number>) {
        let str = "",
            array = new Uint8Array(buffer);

        for (let i = 0; i < array.byteLength; i++) {
            str += String.fromCharCode(array[i]);
        }

        return btoa(str);
    }

    /**
     * Construct detect request parameters dynamically.
     *
     * @param text text to detect
     *
     * @returns constructed parameters
     */
    constructDetectParams(text: string): AxiosRequestConfig {
        const url = `ttranslatev3?isVertical=1&IG=${this.IG}&IID=${
                this.IID
            }&SFX=${this.count.toString()}`,
            data = `&fromLang=auto-detect&to=zh-Hans&text=${encodeURIComponent(
                text
            )}&token=${encodeURIComponent(this.token)}&key=${encodeURIComponent(this.key)}`;

        return {
            method: "POST",
            baseURL: this.HOST,
            url,
            headers: this.HEADERS,
            data,
        };
    }

    /**
     * Construct translate request parameters dynamically.
     *
     * @param text text to translate
     * @param from source language
     * @param to target language
     *
     * @returns constructed parameters
     */
    constructTranslateParams(text: string, from: string, to: string): AxiosRequestConfig {
        const translateURL = `ttranslatev3?isVertical=1&IG=${this.IG}&IID=${
                this.IID
            }&SFX=${this.count.toString()}`,
            translateData = `&fromLang=${this.LAN_TO_CODE.get(from)}&to=${this.LAN_TO_CODE.get(
                to
            )}&text=${encodeURIComponent(text)}&token=${encodeURIComponent(
                this.token
            )}&key=${encodeURIComponent(this.key)}`;

        return {
            method: "POST",
            baseURL: this.HOST,
            url: translateURL,
            headers: this.HEADERS,
            data: translateData,
        };
    }

    /**
     * Construct lookup request parameters dynamically.
     *
     * @param text text to lookup
     * @param from source language
     * @param to target language
     *
     * @returns constructed parameters
     */
    constructLookupParams(text: string, from: string, to: string): AxiosRequestConfig {
        const lookupURL = `tlookupv3?isVertical=1&IG=${this.IG}&IID=${
                this.IID
            }&SFX=${this.count.toString()}`,
            lookupData = `&from=${
                // Use detected language.
                from
            }&to=${this.LAN_TO_CODE.get(to)}&text=${encodeURIComponent(
                text
            )}&token=${encodeURIComponent(this.token)}&key=${encodeURIComponent(this.key)}`;

        return {
            method: "POST",
            baseURL: this.HOST,
            url: lookupURL,
            headers: this.HEADERS,
            data: lookupData,
        };
    }

    /**
     * Construct example request parameters dynamically.
     *
     * @param from source language
     * @param to target language
     * @param text original text
     * @param translation text translation
     *
     * @returns constructed parameters
     */
    constructExampleParams(
        from: string,
        to: string,
        text: string,
        translation: string
    ): AxiosRequestConfig {
        const exampleURL = `texamplev3?isVertical=1&IG=${this.IG}&IID=${
                this.IID
            }&SFX=${this.count.toString()}`,
            exampleData = `&from=${
                // Use detected language.
                from
            }&to=${this.LAN_TO_CODE.get(to)}&text=${encodeURIComponent(
                text
            )}&translation=${encodeURIComponent(translation)}&token=${encodeURIComponent(
                this.token
            )}&key=${encodeURIComponent(this.key)}`;

        return {
            method: "POST",
            baseURL: this.HOST,
            url: exampleURL,
            headers: this.HEADERS,
            data: exampleData,
        };
    }

    /**
     * Construct TTS request parameters dynamically.
     *
     * @param text text to pronounce
     * @param lang language of text
     * @param speed pronounce speed
     *
     * @returns constructed parameters
     */
    constructTTSParams(text: string, lang: string, speed: PronunciationSpeed) {
        const url = `https://${this.TTS_AUTH.region}.tts.speech.microsoft.com/cognitiveservices/v1?`;

        const headers = {
            "Content-Type": "application/ssml+xml",
            Authorization: `Bearer ${this.TTS_AUTH.token}`,
            "X-MICROSOFT-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
            "cache-control": "no-cache",
        };

        return {
            method: "POST",
            baseURL: url,
            headers,
            data: this.generateTTSData(text, lang, speed),
            responseType: "arraybuffer",
        } as AxiosRequestConfig;
    }

    /**
     * Request APIs.
     *
     * This is a wrapper of axios with retrying and error handling supported.
     *
     * @param constructParams request parameters constructor
     * @param constructParamsArgs request parameters constructor arguments
     * @param retry whether retry is needed
     *
     * @returns Promise of response data
     */
    async request(
        constructParams: (...args: any[]) => AxiosRequestConfig,
        constructParamsArgs: string[],
        retry = true
    ) {
        let retryCount = 0;
        const requestOnce = async (): Promise<any> => {
            this.count++;
            const response = (await axios(
                constructParams.call(this, ...constructParamsArgs)
            )) as AxiosResponse<any>;

            /**
             * Status codes 401 and 429 mean that Bing thinks we are robots. We have to wait for it to calm down.
             */
            if (response.status === 401 || response.status === 429) {
                // Throw error.
                throw {
                    errorType: "API_ERR",
                    errorCode: response.status,
                    errorMsg: "Request too frequently!",
                };
            }

            /**
             * Bing redirects user requests based on user region. For example, if we are in China and request
             * www.bing.com, we will be redirected to cn.bing.com. This causes translating error because IG and IID
             * for one region are not usable for another. Therefore, we need to update HOST, HOME_PAGE, IG and IID
             * whenever a redirection happened.
             *
             * If the requested host is different from the original host, which means there was a redirection,
             * update HOST and HOME_PAGE with the redirecting host and retry.
             */
            const responseHost = /(https:\/\/.*\.bing\.com\/).*/g.exec(
                response.request.responseURL
            );
            if (responseHost && responseHost[1] !== this.HOST) {
                this.HOST = responseHost[1];
                this.HOME_PAGE = `${this.HOST}translator`;
                return await this.updateTokens().then(requestOnce);
            }

            /**
             * statusCode will indicate the status of translating.
             *
             * no statusCode or 200: translated successfully
             * 205: tokens need to be updated
             */
            const statusCode = response.data.StatusCode || response.data.statusCode || 200;
            switch (statusCode) {
                case 200:
                    return response.data;
                case 205:
                    return await this.updateTokens().then(requestOnce);
                default:
                    break;
            }

            // Retry after unknown failure.
            if (retry && retryCount < this.MAX_RETRY) {
                retryCount++;
                return await this.updateTokens().then(requestOnce);
            }

            // Throw error.
            throw {
                errorType: "API_ERR",
                errorCode: statusCode,
                errorMsg: "Request failed.",
            };
        };

        if (!this.tokensInitiated) {
            await this.updateTokens();
            this.tokensInitiated = true;
        }

        return requestOnce();
    }

    /**
     * Get supported languages of this API.
     *
     * @returns {Set<String>} supported languages
     */
    supportedLanguages() {
        return new Set(this.LAN_TO_CODE.keys());
    }

    /**
     * Detect language of given text.
     *
     * @param text text to detect
     *
     * @returns detected language Promise
     */
    async detect(text: string) {
        try {
            const response = await this.request(this.constructDetectParams, [text]);
            const result = response[0].detectedLanguage.language;
            return this.CODE_TO_LAN.get(result);
        } catch (error: any) {
            error.errorMsg = error.errorMsg || error.message;
            error.errorAct = {
                api: "bing",
                action: "detect",
                text,
                from: null,
                to: null,
            };
            throw error;
        }
    }

    /**
     * Translate given text.
     *
     * This method will request the translate API firstly with 2 purposes:
     *     1. detect the language of the translating text
     *     2. get a basic translation of the text incase lookup is not available
     *
     * After that, it will attempt to request the lookup API to get detailed translation.
     * If that failed, the method will use the translation from the translate API instead.
     *
     * @param text text to translate
     * @param from source language
     * @param to target language
     *
     * @returns {Promise<Object>} translation Promise
     */
    /**
     * Fast translate — only the translate API, returns mainMeaning immediately
     * AND caches the raw response for later enrichment.
     */
    _cachedTransResponse: any = null;

    async translateQuick(text: string, from: string, to: string): Promise<TranslationResult> {
        const transResponse = await this.request(this.constructTranslateParams, [text, from, to]);
        this._cachedTransResponse = transResponse; // cache for enrich()
        return this.parseTranslateResult(transResponse, {
            originalText: text,
            mainMeaning: "",
        });
    }

    /**
     * Enrich a quick translate result with dictionary details.
     * Uses cached translate response — no extra API calls.
     */
    // eslint-disable-next-line no-unused-vars
    async enrich(text: string, _from: string, to: string, quickResult: TranslationResult): Promise<TranslationResult> {
        const transResponse = this._cachedTransResponse;
        if (!transResponse) return quickResult;

        // Fetch Youdao source phonetics (US/UK IPA or pinyin) in parallel with Bing lookup
        const sourcePhoneticsP = this._youdao.fetchPhonetics(text, _from);

        try {
            const lookupResponse = await this.request(
                this.constructLookupParams,
                [text, transResponse[0].detectedLanguage.language, to],
                false
            );
            const lookupResult = this.parseLookupResult(lookupResponse, quickResult);

            let result: TranslationResult;
            try {
                const exampleResponse = await this.request(
                    this.constructExampleParams,
                    [transResponse[0].detectedLanguage.language, to, text, lookupResult.mainMeaning],
                    false
                );
                result = this.parseExampleResult(exampleResponse, lookupResult);
            } catch {
                result = lookupResult;
            }

            // Source pronunciation ← Youdao (US/UK IPA for English, pinyin for Chinese)
            const source = await sourcePhoneticsP;
            if (source.sPronunciation) result.sPronunciation = source.sPronunciation;
            if (source.tPronunciation) result.tPronunciation = source.tPronunciation;

            // Target pronunciation: Youdao pinyin for Chinese target word
            if (result.mainMeaning && to === "zh-CN") {
                const targetPinyin = await this._youdao.fetchPhonetics(result.mainMeaning, to);
                if (targetPinyin.sPronunciation) result.targetPronunciation = targetPinyin.sPronunciation;
            }

            return result;
        } catch (e) {
            console.warn("[Bing] Enrich failed, using quick result:", e);
            const source = await sourcePhoneticsP;
            if (source.sPronunciation) quickResult.sPronunciation = source.sPronunciation;
            if (source.tPronunciation) quickResult.tPronunciation = source.tPronunciation;
            return quickResult;
        }
    }

    async translate(text: string, from: string, to: string) {
        const quick = await this.translateQuick(text, from, to);
        return this.enrich(text, from, to, quick); // enrich() handles Youdao phonetics internally
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
        // Pause audio in case that it's playing.
        this.stopPronounce();

        let retryCount = 0;
        const pronounceOnce = async (): Promise<void> => {
            try {
                const TTSResponse = await this.request(
                    this.constructTTSParams,
                    [text, language, speed],
                    false
                );
                this.AUDIO.src = `data:audio/mp3;base64,${this.arrayBufferToBase64(TTSResponse)}`;
                await this.AUDIO.play();
            } catch (error: any) {
                if (retryCount < this.MAX_RETRY) {
                    retryCount++;
                    return this.updateTTSAuth().then(pronounceOnce);
                }
                const errorAct = {
                    api: "bing",
                    action: "pronounce",
                    text,
                    from: language,
                    to: null,
                };

                if (error.errorType) {
                    error.errorAct = errorAct;
                    throw error;
                }

                throw {
                    errorType: "NET_ERR",
                    errorCode: 0,
                    errorMsg: error.message,
                    errorAct,
                };
            }
        };

        if (!(this.TTS_AUTH.region.length > 0 && this.TTS_AUTH.token.length > 0)) {
            await this.updateTTSAuth();
        }

        return pronounceOnce();
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

export default BingTranslator;
