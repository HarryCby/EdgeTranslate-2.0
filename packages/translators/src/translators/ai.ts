import axios from "../axios";

/**
 * AI Translator using OpenAI-compatible API.
 * Supports: DeepSeek, Groq, OpenAI, SiliconFlow, Ollama, etc.
 */
class AITranslator {
    apiUrl: string;
    apiKey: string;
    model: string;

    constructor(apiUrl?: string, apiKey?: string, model?: string) {
        this.apiUrl = apiUrl || "";
        this.apiKey = apiKey || "";
        this.model = model || "deepseek-chat";
    }

    /**
     * Translate with context using AI.
     * @param text The selected text to translate
     * @param context Surrounding text for context
     * @param mainMeaning Basic translation result for reference
     * @returns AI's context-aware translation
     */
    async translateWithContext(
        text: string,
        context: string,
        mainMeaning?: string,
        modelOverride?: string
    ): Promise<string> {
        if (!this.apiUrl || !this.apiKey) {
            throw new Error("AI API not configured");
        }

        const model = modelOverride || this.model;
        const baseT = mainMeaning ? `基础翻译: "${mainMeaning}"\n` : "";
        const prompt = `你是一个翻译助手。请根据上下文给出最准确的中文翻译。

${baseT}上下文: "${context}"
需要翻译的文本: "${text}"

请直接给出翻译结果，不要解释。`;

        const endpoint = this.apiUrl.replace(/\/+$/, "") + "/v1/chat/completions";

        const response: any = await axios({
            method: "POST",
            url: endpoint,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
            },
            data: {
                model,
                messages: [
                    { role: "system", content: "你是一个专业翻译助手，根据上下文给出准确翻译。" },
                    { role: "user", content: prompt },
                ],
                temperature: 0.3,
                max_tokens: 500,
            },
        });

        const content = response?.data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("AI returned empty response");
        }
        return content.trim();
    }
}

export default AITranslator;
