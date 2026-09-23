// Web Audio API emergency siren generator
// No external MP3/WAV files required; synthesizes sound reliably in the browser.

class AudioAlarmService {
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private sirenInterval: number | null = null;
  private isPlaying = false;

  private initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public unlockAudio() {
    this.initAudio();
  }

  public startSiren() {
    if (this.isPlaying) return;
    this.initAudio();

    if (!this.audioCtx) return;

    try {
      this.isPlaying = true;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();

      let toggle = false;
      this.sirenInterval = window.setInterval(() => {
        if (!this.audioCtx || !this.isPlaying) return;
        toggle = !toggle;
        const targetFreq = toggle ? 960 : 720;
        osc.frequency.exponentialRampToValueAtTime(targetFreq, this.audioCtx.currentTime + 0.15);
      }, 350);

      this.oscillator = osc;
      this.gainNode = gain;
    } catch (err) {
      console.warn('[AudioAlarm] Could not start audio siren:', err);
    }
  }

  public stopSiren() {
    this.isPlaying = false;
    if (this.sirenInterval) {
      clearInterval(this.sirenInterval);
      this.sirenInterval = null;
    }
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch {
        // Ignore
      }
      this.oscillator = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // Ignore
      }
      this.gainNode = null;
    }
  }

  public playBeep(freq: number = 880, durationMs: number = 150) {
    this.initAudio();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore
        }
      }, durationMs);
    } catch {
      // Ignore
    }
  }
}

export const audioAlarm = new AudioAlarmService();
