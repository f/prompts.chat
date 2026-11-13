// Web Audio API Retro Sound Effects & Music Manager for Promi's School

class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicElement = null;
    this.isMusicPlaying = false;
    this.musicVolume = 0.3;
    this.sfxVolume = 0.5;
    this.musicEnabled = localStorage.getItem('kids-music-enabled') !== 'false';
    this.synthLoopInterval = null;
    this.useSynthFallback = false;

    // Load saved volume
    const savedVol = localStorage.getItem('kids-music-volume');
    if (savedVol) {
      this.musicVolume = parseFloat(savedVol);
    }
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 8-bit Tone Generator
  playTone(freq, duration, type = 'square', startDelay = 0, gainVal = 0.15) {
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime + startDelay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(gainVal * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  // Sound: UI Click
  playClick() {
    this.playTone(600, 0.05, 'square', 0, 0.1);
  }

  // Sound: Coin Pick / Star
  playCoin() {
    this.playTone(987.77, 0.08, 'square', 0, 0.2); // B5
    this.playTone(1318.51, 0.25, 'square', 0.08, 0.2); // E6
  }

  // Sound: Success / Correct Answer
  playSuccess() {
    this.playTone(523.25, 0.08, 'triangle', 0, 0.2);    // C5
    this.playTone(659.25, 0.08, 'triangle', 0.08, 0.2); // E5
    this.playTone(783.99, 0.08, 'triangle', 0.16, 0.2); // G5
    this.playTone(1046.50, 0.25, 'square', 0.24, 0.25); // C6
  }

  // Sound: Error / Try Again
  playError() {
    this.playTone(220, 0.12, 'sawtooth', 0, 0.15);
    this.playTone(180, 0.2, 'sawtooth', 0.1, 0.15);
  }

  // Sound: Promi Cute Robot Chirp
  playPromiBeep() {
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.15);

      gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch(e) {}
  }

  // Sound: Level Win Fanfare
  playFanfare() {
    const notes = [
      { f: 523.25, d: 0.12, t: 0 },
      { f: 659.25, d: 0.12, t: 0.12 },
      { f: 783.99, d: 0.12, t: 0.24 },
      { f: 1046.50, d: 0.4, t: 0.36 },
      { f: 880.00, d: 0.15, t: 0.78 },
      { f: 1046.50, d: 0.5, t: 0.95 },
    ];
    notes.forEach(n => {
      this.playTone(n.f, n.d, 'square', n.t, 0.2);
    });
  }

  // Background Music Controls
  initMusic() {
    if (!this.musicElement) {
      this.musicElement = new Audio('kids-music.mp3');
      this.musicElement.loop = true;
      this.musicElement.volume = this.musicVolume;

      // In case of local file restriction (file:/// CORS), fallback to Web Audio Synth
      this.musicElement.addEventListener('error', () => {
        console.log("Local mp3 blocked, switching to retro 8-bit synthetic background music!");
        this.useSynthFallback = true;
        if (this.isMusicPlaying) {
          this.startSynthMusic();
        }
      });
    }
  }

  toggleMusic() {
    this.initContext();
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('kids-music-enabled', this.musicEnabled.toString());

    if (this.musicEnabled) {
      this.playMusic();
    } else {
      this.pauseMusic();
    }
    return this.musicEnabled;
  }

  playMusic() {
    if (!this.musicEnabled) return;
    this.initContext();
    this.initMusic();

    this.isMusicPlaying = true;
    if (this.useSynthFallback) {
      this.startSynthMusic();
      return;
    }

    if (this.musicElement) {
      this.musicElement.volume = this.musicVolume;
      const playPromise = this.musicElement.play();
      if (playPromise) {
        playPromise.catch(() => {
          this.useSynthFallback = true;
          this.startSynthMusic();
        });
      }
    }
  }

  pauseMusic() {
    this.isMusicPlaying = false;
    if (this.musicElement) {
      this.musicElement.pause();
    }
    this.stopSynthMusic();
  }

  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('kids-music-volume', this.musicVolume.toString());
    if (this.musicElement) {
      this.musicElement.volume = this.musicVolume;
    }
  }

  // Procedural 8-Bit Chiptune Synth Melody (Loop)
  startSynthMusic() {
    this.stopSynthMusic();
    if (!this.musicEnabled) return;

    // Charming gentle retro 8-bit progression: C - G - Am - F
    const melodyNotes = [
      523.25, 659.25, 783.99, 659.25, // C - E - G - E
      392.00, 493.88, 587.33, 493.88, // G - B - D - B
      440.00, 523.25, 659.25, 523.25, // A - C - E - C
      349.23, 440.00, 523.25, 659.25  // F - A - C - E
    ];
    let noteIdx = 0;

    this.synthLoopInterval = setInterval(() => {
      if (!this.isMusicPlaying || !this.musicEnabled) {
        this.stopSynthMusic();
        return;
      }
      const freq = melodyNotes[noteIdx % melodyNotes.length];
      this.playTone(freq, 0.22, 'triangle', 0, this.musicVolume * 0.15);
      // Soft bass note on every 4th beat
      if (noteIdx % 4 === 0) {
        const bassFreq = freq / 4;
        this.playTone(bassFreq, 0.45, 'sine', 0, this.musicVolume * 0.25);
      }
      noteIdx++;
    }, 280);
  }

  stopSynthMusic() {
    if (this.synthLoopInterval) {
      clearInterval(this.synthLoopInterval);
      this.synthLoopInterval = null;
    }
  }
}

window.audioManager = new AudioManager();
