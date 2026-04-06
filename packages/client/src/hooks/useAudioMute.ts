import { useState, useEffect, useCallback } from 'react';
import { stopMenuMusic, startMenuMusic, setMusicVolume, setCrowdVolume } from '../phaser/utils/music';

let globalMuted = localStorage.getItem('winbig_muted') === 'true';

export function isGlobalMuted(): boolean {
  return globalMuted;
}

export function setGlobalMuted(muted: boolean) {
  globalMuted = muted;
  localStorage.setItem('winbig_muted', muted ? 'true' : 'false');
}

export function useAudioMute() {
  const [muted, setMuted] = useState(globalMuted);

  const toggle = useCallback(() => {
    const newVal = !muted;
    setMuted(newVal);
    setGlobalMuted(newVal);

    if (newVal) {
      // Mute everything
      stopMenuMusic();
      setMusicVolume(0);
      setCrowdVolume(0, 0.1);
    } else {
      // Unmute — restart menu music if not in a race
      startMenuMusic();
    }
  }, [muted]);

  return { muted, toggle };
}
