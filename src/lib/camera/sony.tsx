import type { SonyCameraConnection, SonyCameraState, SonyLiveViewProps } from "./sony.types";

const unavailable: SonyCameraState = { state: "unsupported", message: "Sony USB camera support is unavailable on this platform." };

export function useSonyCameraConnection(_enabled = true): SonyCameraConnection {
  return {
    available: false,
    state: unavailable,
    connect: async () => unavailable,
    capturePhoto: async () => { throw new Error(unavailable.message); },
  };
}

export function SonyCameraLiveView(_props: SonyLiveViewProps) {
  return null;
}

export type { SonyCameraState, SonyPhoto } from "./sony.types";
