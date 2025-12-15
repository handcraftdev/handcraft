import { useState, useCallback } from "react";

export interface ViewerState {
  controlsVisible: boolean;
  isFullscreen: boolean;
  showInfo: boolean;
}

export function useViewerState() {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const toggleControls = useCallback(() => {
    setControlsVisible(prev => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const toggleInfo = useCallback(() => {
    setShowInfo(prev => !prev);
  }, []);

  const hideControls = useCallback(() => {
    setControlsVisible(false);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
  }, []);

  return {
    controlsVisible,
    isFullscreen,
    showInfo,
    toggleControls,
    toggleFullscreen,
    toggleInfo,
    hideControls,
    showControls,
  };
}
