import axios from "axios";
import TRANSLATOR from "../src/translators/tencent";

// Tencent Cloud TMT API credentials.
// Set via environment variables or replace with your own keys.
const SECRET_ID = process.env.TENCENT_SECRET_ID || "";
const SECRET_KEY = process.env.TENCENT_SECRET_KEY || "";

const maybeDescribe = SECRET_ID && SECRET_KEY ? describe : describe.skip;
const maybeIt = SECRET_ID && SECRET_KEY ? it : it.skip;

maybeDescribe("tencent translator api", () => {
    const translator = new TRANSLATOR(SECRET_ID, SECRET_KEY);

    beforeAll(() => {
        // set http module of nodejs as axios' request method
        let path = require("path");
        let lib = path.join(path.dirname(require.resolve("axios")), "lib/adapters/http");
        axios.defaults.adapter = require(lib);
    });

    maybeIt("to detect language of English text", async () => {
        const result = await translator.detect("hello");
        expect(result).toEqual("en");
    }, 15000);

    maybeIt("to detect language of Chinese text", async () => {
        const result = await translator.detect("你好");
        expect(result).toEqual("zh-CN");
    }, 15000);

    maybeIt("to translate English to Chinese", async () => {
        const result = await translator.translate("hello world", "en", "zh-CN");
        expect(result.mainMeaning).toBeTruthy();
        expect(typeof result.mainMeaning).toEqual("string");
        expect(result.mainMeaning.length).toBeGreaterThan(0);
    }, 15000);
});
