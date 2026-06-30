/**
 * VoiceManager – handles browser speechSynthesis for Friday.
 *
 * Priority list for British female voices (first match wins):
 *   1. Google UK English Female
 *   2. Microsoft Sonia Online (Natural)
 *   3. Microsoft Libby
 *   4. Siri British Female
 *   5. Karen (UK English)
 *
 * If none of the preferred voices are available the manager falls back to
 * the first en-GB voice it can find, and then to the first en-* voice.
 */
class VoiceManager {
  constructor() {
    this._voice = null;
    this._lang = 'en-GB';
    this._pitch = 1.0;
    this._rate = 0.9;

    this._preferredNames = [
      'Google UK English Female',
      'Microsoft Sonia Online (Natural)',
      'Microsoft Libby',
      'Siri British Female',
      'Karen (UK English)',
    ];

    // speechSynthesis may not have loaded voices yet – listen for the event.
    if (typeof speechSynthesis !== 'undefined') {
      if (speechSynthesis.getVoices().length > 0) {
        this._selectVoice();
      } else {
        speechSynthesis.addEventListener('voiceschanged', () => {
          this._selectVoice();
        });
      }
    }
  }

  /**
   * Pick the best available voice and store it in this._voice.
   */
  _selectVoice() {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;

    // 1. Try each preferred name in order (case-insensitive).
    for (const name of this._preferredNames) {
      const match = voices.find(
        (v) => v.name.toLowerCase() === name.toLowerCase()
      );
      if (match) {
        this._voice = match;
        return;
      }
    }

    // 2. Fall back to any en-GB voice.
    const gbVoice = voices.find((v) => v.lang === 'en-GB');
    if (gbVoice) {
      this._voice = gbVoice;
      return;
    }

    // 3. Fall back to any English voice.
    const enVoice = voices.find((v) => v.lang.startsWith('en'));
    if (enVoice) {
      this._voice = enVoice;
      return;
    }

    // 4. Use whatever the browser default is (null → browser picks).
    this._voice = null;
  }

  /**
   * Return all voices reported by the browser.
   * @returns {SpeechSynthesisVoice[]}
   */
  getAvailableVoices() {
    if (typeof speechSynthesis === 'undefined') return [];
    return speechSynthesis.getVoices();
  }

  /**
   * Manually set the active voice by its exact name.
   * Pass null or an empty string to reset to auto-selected voice.
   * @param {string|null} name
   */
  setVoiceByName(name) {
    if (!name) {
      this._selectVoice();
      return;
    }
    const voices = speechSynthesis.getVoices();
    const match = voices.find((v) => v.name === name);
    if (match) this._voice = match;
  }

  /**
   * Return the currently active SpeechSynthesisVoice (may be null).
   * @returns {SpeechSynthesisVoice|null}
   */
  get currentVoice() {
    return this._voice;
  }

  /**
   * Speak text using the selected voice.
   * Cancels any ongoing utterance first.
   * @param {string} text
   */
  speak(text) {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this._lang;
    utterance.pitch = this._pitch;
    utterance.rate = this._rate;

    if (this._voice) {
      utterance.voice = this._voice;
    }

    speechSynthesis.speak(utterance);
  }

  /** Stop any current speech immediately. */
  stop() {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }
}

// Expose a singleton for the rest of the app.
const voiceManager = new VoiceManager();
