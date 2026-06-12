import axios from "axios";
import BaiduTranslator from "../src/translators/baidu";

// Baidu Official API credentials.
const APP_ID = process.env.BAIDU_APP_ID || "";
const APP_KEY = process.env.BAIDU_APP_KEY || "";

const maybeDescribe = APP_ID && APP_KEY ? describe : describe.skip;
const maybeIt = APP_ID && APP_KEY ? it : it.skip;

maybeDescribe("baidu translator api", () => {
    const TRANSLATOR = new BaiduTranslator(APP_ID, APP_KEY);

    beforeAll(() => {
        let path = require("path");
        let lib = path.join(path.dirname(require.resolve("axios")), "lib/adapters/http");
        axios.defaults.adapter = require(lib);
    });

    maybeIt("to detect language of English text", async () => {
        const result = await TRANSLATOR.detect("hello");
        expect(result).toEqual("en");
    }, 15000);

    maybeIt("to detect language of Chinese text", async () => {
        const result = await TRANSLATOR.detect("你好");
        expect(result).toEqual("zh-CN");
    }, 15000);

    maybeIt("to translate English to Chinese", async () => {
        const result = await TRANSLATOR.translate("hello", "en", "zh-CN");
        expect(result.mainMeaning).toBeTruthy();
        expect(typeof result.mainMeaning).toEqual("string");
    }, 15000);
});
