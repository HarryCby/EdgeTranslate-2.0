/**
 * Local TTS service provider.
 * In MV3 service worker, window.speechSynthesis is not available,
 * so this class gracefully degrades.
 */
class LocalTTS {
    constructor() {
        this.speaking = false;
        this.synthesis = typeof window !== "undefined" && window.speechSynthesis;
        if (!this.synthesis) {
            console.log("[LocalTTS] speechSynthesis not available (service worker context)");
        }
    }

    /**
     * Speak given text.
     *
     * @param {String} text text to pronounce
     * @param {String} language language of text
     * @param {String} speed "fast" or "slow"
     *
     * @returns {boolean} is speaking succeeded?
     */
    speak(text, language, speed) {
        if (!this.synthesis) return false;
        // Check if the language is supported.
        if (!this.synthesis.getVoices().find((voice) => voice.lang.startsWith(language))) {
            console.log(`No voice for language: "${language}"`);
            return false;
        }

        this.speaking = true;
        let utter = new SpeechSynthesisUtterance(text);
        utter.lang = language;
        utter.rate = speed === "fast" ? 1.0 : 0.6;

        // Set speaking to false when finished speaking.
        utter.onend = (() => (this.speaking = false)).bind(this);

        this.synthesis.speak(utter);
        return true;
    }

    /**
     * Pause speaking.
     */
    pause() {
        if (this.speaking) {
            this.synthesis.cancel();
            this.speaking = false;
        }
    }
}

export default LocalTTS;
