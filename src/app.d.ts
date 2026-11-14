// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  interface Window {
    /** Present only in dev builds while the debug mode overlay is mounted. */
    __WAR_ON_BOARD_DEBUG__?: import("$lib/presentation/debugMode").WarOnBoardDebugHandle;
  }
}

export {};
