declare global {
  interface Window {
    /** Dev builds only, while the debug overlay is mounted. */
    __WAR_ON_BOARD_DEBUG__?: import("#lib/presentation/debugMode.ts").WarOnBoardDebugHandle;
  }
}

export {};
