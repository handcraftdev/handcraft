import { useState, useCallback, useRef, useEffect } from "react";

export interface MediaPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
}

export interface MediaPlaybackControls {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  skipForward: (seconds: number) => void;
  skipBackward: (seconds: number) => void;
}

export function useMediaPlayback(
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>,
  isActive?: boolean
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // Set up event listeners
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const updateTime = () => setCurrentTime(media.currentTime);
    const updateDuration = () => setDuration(media.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    media.addEventListener("timeupdate", updateTime);
    media.addEventListener("loadedmetadata", updateDuration);
    media.addEventListener("durationchange", updateDuration);
    media.addEventListener("play", handlePlay);
    media.addEventListener("pause", handlePause);
    media.addEventListener("ended", handleEnded);

    // Initial state
    if (media.readyState >= 1) {
      updateDuration();
    }
    setIsPlaying(!media.paused);

    return () => {
      media.removeEventListener("timeupdate", updateTime);
      media.removeEventListener("loadedmetadata", updateDuration);
      media.removeEventListener("durationchange", updateDuration);
      media.removeEventListener("play", handlePlay);
      media.removeEventListener("pause", handlePause);
      media.removeEventListener("ended", handleEnded);
    };
  }, [mediaRef]);

  // Play/pause based on isActive
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (isActive) {
      media.play().catch(() => {});
    } else {
      media.pause();
    }
  }, [isActive, mediaRef]);

  const play = useCallback(() => {
    const media = mediaRef.current;
    if (media) media.play().catch(() => {});
  }, [mediaRef]);

  const pause = useCallback(() => {
    const media = mediaRef.current;
    if (media) media.pause();
  }, [mediaRef]);

  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      if (media.paused) {
        media.play().catch(() => {});
      } else {
        media.pause();
      }
    }
  }, [mediaRef]);

  const seek = useCallback((time: number) => {
    const media = mediaRef.current;
    if (media) {
      const maxTime = media.duration || duration;
      media.currentTime = Math.max(0, Math.min(time, maxTime));
    }
  }, [mediaRef, duration]);

  const setVolume = useCallback((vol: number) => {
    const newVolume = Math.max(0, Math.min(1, vol));
    setVolumeState(newVolume);
    const media = mediaRef.current;
    if (media) media.volume = newVolume;
  }, [mediaRef]);

  const toggleMute = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      media.muted = !media.muted;
      setIsMuted(media.muted);
    }
  }, [mediaRef]);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    const media = mediaRef.current;
    if (media) media.playbackRate = rate;
  }, [mediaRef]);

  const skipForward = useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (media) {
      const maxTime = media.duration || duration;
      media.currentTime = Math.min(media.currentTime + seconds, maxTime);
      setCurrentTime(media.currentTime);
    }
  }, [mediaRef, duration]);

  const skipBackward = useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (media) {
      media.currentTime = Math.max(media.currentTime - seconds, 0);
      setCurrentTime(media.currentTime);
    }
  }, [mediaRef]);

  return {
    state: { isPlaying, currentTime, duration, volume, isMuted, playbackRate },
    controls: { play, pause, togglePlay, seek, setVolume, toggleMute, setPlaybackRate, skipForward, skipBackward },
  };
}
