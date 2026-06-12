import axios from "axios";
import BingTranslator from "../src/translators/bing";

describe("bing translator api", () => {
    const TRANSLATOR = new BingTranslator();

    beforeAll(() => {
        // set http module of nodejs as axios' request method
        let path = require("path");
        let lib = path.join(path.dirname(require.resolve("axios")), "lib/adapters/http");
        axios.defaults.adapter = require(lib);
    });

    it("to update IG and IID", async () => {
        await TRANSLATOR.updateTokens().then(() => {
            expect(typeof TRANSLATOR.IG).toEqual("string");
            expect(TRANSLATOR.IG.length).toBeGreaterThan(0);

            expect(typeof TRANSLATOR.IID).toEqual("string");
            expect(TRANSLATOR.IID!.length).toBeGreaterThan(0);
        });
    });

    it("to detect language of English text", async () => {
        const result = await TRANSLATOR.detect("hello");
        expect(result).toEqual("en");
    });

    it("to detect language of Chinese text", async () => {
        const result = await TRANSLATOR.detect("你好");
        // Bing may detect simplified Chinese text as zh-TW or zh-CN depending on region
        expect(["zh-CN", "zh-TW", "zh-Hans", "zh-Hant"]).toContain(result);
    });

    it("to translate English to Chinese", async () => {
        const result = await TRANSLATOR.translate("hello", "en", "zh-CN");
        expect(result.mainMeaning).toBeTruthy();
        // Verify translation result contains meaningful output
        expect(typeof result.mainMeaning).toEqual("string");
        expect(result.mainMeaning.length).toBeGreaterThan(0);
    });

    it("to return supported languages", () => {
        const langs = TRANSLATOR.supportedLanguages();
        expect(langs.size).toBeGreaterThan(0);
        expect(langs.has("en")).toBe(true);
        expect(langs.has("zh-CN")).toBe(true);
    });
});
