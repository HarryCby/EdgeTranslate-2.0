import type { AxiosResponse } from "axios";
import axios from "../axios";
import { PronunciationSpeed, TranslationResult } from "../types";

/**
 * Supported languages — mapped to Tencent Cloud TMT language codes.
 * Reference: https://cloud.tencent.com/document/product/551/15619
 */
const LANGUAGES: [string, string][] = [
    ["auto", "auto"],
    ["zh-CN", "zh"],
    ["zh-TW", "zh-TW"],
    ["en", "en"],
    ["ja", "ja"],
    ["ko", "ko"],
    ["fr", "fr"],
    ["es", "es"],
    ["it", "it"],
    ["de", "de"],
    ["tr", "tr"],
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
 * HMAC-SHA256 using Web Crypto API (available in browsers and Node.js 19+).
 */
async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

/**
 * SHA256 hex digest using Web Crypto API (available in browsers and Node.js 19+).
 */
async function sha256Hex(message: string): Promise<string> {
    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(message)
    );
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Generate TC3-HMAC-SHA256 signature for Tencent Cloud API.
 */
async function signTC3(
    secretId: string,
    secretKey: string,
    action: string,
    params: Record<string, any>
) {
    const endpoint = "tmt.tencentcloudapi.com";
    const service = "tmt";
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split("T")[0];
    const payload = JSON.stringify(params);

    // Step 1: Canonical Request
    const hashedPayload = await sha256Hex(payload);
    const httpMethod = "POST";
    const canonicalUri = "/";
    const canonicalQueryString = "";
    const contentType = "application/json; charset=utf-8";
    const canonicalHeaders = [
        `content-type:${contentType}`,
        `host:${endpoint}`,
        `x-tc-action:${action.toLowerCase()}`,
    ].join("\n") + "\n";
    const signedHeaders = "content-type;host;x-tc-action";
    const canonicalRequest = [
        httpMethod,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        hashedPayload,
    ].join("\n");

    // Step 2: String to Sign
    const algorithm = "TC3-HMAC-SHA256";
    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
    const stringToSign = [
        algorithm,
        timestamp,
        credentialScope,
        hashedCanonicalRequest,
    ].join("\n");

    // Step 3: Sign
    const enc = new TextEncoder();
    const kDate = await hmacSha256(enc.encode(`TC3${secretKey}`), date);
    const kService = await hmacSha256(new Uint8Array(kDate), service);
    const kSigning = await hmacSha256(new Uint8Array(kService), "tc3_request");
    const signatureBytes = await hmacSha256(new Uint8Array(kSigning), stringToSign);
    const signature = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    // Step 4: Authorization
    const authorization = [
        `${algorithm} Credential=${secretId}/${credentialScope}`,
        `SignedHeaders=${signedHeaders}`,
        `Signature=${signature}`,
    ].join(", ");

    return { authorization, timestamp, payload, contentType };
}

/**
 * Tencent Cloud TMT translator.
 */
class TencentTranslator {
    secretId: string;
    secretKey: string;

    /**
     * Max retry times.
     */
    MAX_RETRY = 1;

    /**
     * Tencent Cloud TMT API endpoint.
     */
    ENDPOINT = "https://tmt.tencentcloudapi.com";

    /**
     * API version.
     */
    API_VERSION = "2018-03-21";

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

    constructor(secretId: string, secretKey: string) {
        this.secretId = secretId;
        this.secretKey = secretKey;
    }

    /**
     * Call Tencent Cloud TMT API with TC3 signing.
     */
    async callAPI(action: string, params: Record<string, any>) {
        const { authorization, timestamp, payload, contentType } = await signTC3(
            this.secretId,
            this.secretKey,
            action,
            { ...params, ProjectId: 0 }
        );

        const response = (await axios({
            method: "POST",
            url: this.ENDPOINT,
            headers: {
                "Content-Type": contentType,
                "Host": "tmt.tencentcloudapi.com",
                "X-TC-Action": action,
                "X-TC-Version": this.API_VERSION,
                "X-TC-Timestamp": String(timestamp),
                "X-TC-Region": "ap-guangzhou",
                "Authorization": authorization,
            },
            data: payload,
        })) as AxiosResponse<any>;

        if (response.data.Response.Error) {
            const err = response.data.Response.Error;
            throw {
                errorType: "API_ERR",
                errorCode: err.Code,
                errorMsg: err.Message,
            };
        }

        return response.data.Response;
    }

    /**
     * Get supported languages of this API.
     */
    supportedLanguages() {
        return new Set(this.LAN_TO_CODE.keys());
    }

    /**
     * Detect language of given text.
     */
    async detect(text: string): Promise<string> {
        const result = await this.callAPI("LanguageDetect", { Text: text });
        const lang = result.Lang;
        // TMT returns "zh" for Chinese, map to our internal code
        if (lang === "zh") return "zh-CN";
        if (lang === "zh-TW") return "zh-TW";
        return lang;
    }

    /**
     * Translate given text.
     */
    async translate(text: string, from: string, to: string) {
        let retryCount = 0;

        const translateOnce = async (): Promise<TranslationResult> => {
            try {
                const result = await this.callAPI("TextTranslate", {
                    SourceText: text,
                    Source: this.LAN_TO_CODE.get(from) || "auto",
                    Target: this.LAN_TO_CODE.get(to) || "zh",
                });

                const parsed: TranslationResult = {
                    originalText: text,
                    mainMeaning: result.TargetText,
                };

                return parsed;
            } catch (error: any) {
                // Retry on auth/network errors
                if (retryCount < this.MAX_RETRY) {
                    retryCount++;
                    return translateOnce();
                }

                error.errorAct = {
                    api: "tencent",
                    action: "translate",
                    text,
                    from,
                    to,
                };
                throw error;
            }
        };

        return translateOnce();
    }

    /**
     * Pronounce given text.
     *
     * Tencent Cloud TMT does not provide a free TTS API, so pronunciation
     * will fall back to the local TTS engine in the extension.
     */
    async pronounce(text: string, language: string, speed: PronunciationSpeed) {
        void speed; // TMT has no free TTS — unused but required by interface
        // Throw a NET_ERR so the extension falls back to local TTS.
        throw {
            errorType: "NET_ERR",
            errorCode: 0,
            errorMsg: "Tencent TTS not available, use local TTS instead.",
            errorAct: {
                api: "tencent",
                action: "pronounce",
                text,
                from: language,
                to: null,
            },
        };
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

export default TencentTranslator;
