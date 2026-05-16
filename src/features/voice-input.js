/**
 * Feature 6: Voice Input
 *
 * Adds a microphone button that uses Android's native speech-to-text
 * (Web Speech API / SpeechRecognition) to transcribe voice into the
 * prompt textarea.
 */
const VoiceInput = {
  _recognition: null,
  _listening: false,
  _supported: false,

  isSupported() {
    if (this._supported) return true;
    this._supported = Boolean(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition,
    );
    return this._supported;
  },

  isListening() {
    return this._listening;
  },

  start(onResult, onEnd) {
    if (!this.isSupported()) {
      Acode.toast("Voice input not supported in this WebView");
      return false;
    }
    if (this._listening) {
      this.stop();
      return false;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition;

    this._recognition = new SpeechRecognition();
    this._recognition.continuous = false;
    this._recognition.interimResults = true;
    this._recognition.lang = navigator.language || "en-US";
    this._recognition.maxAlternatives = 1;

    this._recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      if (typeof onResult === "function") onResult(transcript, isFinal);
    };

    this._recognition.onerror = (event) => {
      const msg = event.error === "no-speech"
        ? "No speech detected"
        : event.error === "not-allowed"
          ? "Microphone permission denied"
          : "Voice error: " + (event.error || "unknown");
      Acode.toast(msg);
      this._listening = false;
      if (typeof onEnd === "function") onEnd();
    };

    this._recognition.onend = () => {
      this._listening = false;
      if (typeof onEnd === "function") onEnd();
    };

    try {
      this._recognition.start();
      this._listening = true;
      return true;
    } catch (error) {
      Acode.toast("Voice start failed: " + (error.message || error));
      this._listening = false;
      return false;
    }
  },

  stop() {
    if (this._recognition) {
      try { this._recognition.stop(); } catch (_) {}
    }
    this._listening = false;
  },

  toggle(onResult, onEnd) {
    if (this._listening) {
      this.stop();
      return false;
    }
    return this.start(onResult, onEnd);
  },

  buttonHtml() {
    if (!this.isSupported()) return "";
    const active = this._listening ? " active" : "";
    return `<button class="ace-ai-chip ace-ai-voice-btn${active}" data-act="voice-input" aria-label="Voice input" title="Tap to speak">${this._listening ? "🔴" : "🎤"}</button>`;
  },
};
