import { useCallback, useEffect, useMemo, useState } from "react";

import SonyCameraModule, { SonyCameraView } from "../../../modules/sony-camera";
import type { SonyCameraConnection, SonyCameraState, SonyLiveViewProps } from "./sony.types";

const unavailable: SonyCameraState = { state: "unsupported", message: "Sony USB camera support is not in this build." };

export function useSonyCameraConnection(enabled = true): SonyCameraConnection {
  const nativeModule = SonyCameraModule;
  const available = enabled && nativeModule !== null;
  const [state, setState] = useState<SonyCameraState>(() => available && nativeModule ? nativeModule.getState() : unavailable);

  useEffect(() => {
    if (!available || !nativeModule) return;
    const stateSubscription = nativeModule.addListener("onStateChanged", setState);
    const attachSubscription = nativeModule.addListener("onDeviceAttached", setState);
    return () => {
      stateSubscription.remove();
      attachSubscription.remove();
    };
  }, [available, nativeModule]);

  const connect = useCallback(async () => available && nativeModule ? nativeModule.connect() : unavailable, [available, nativeModule]);
  const capturePhoto = useCallback(async () => {
    if (!available || !nativeModule) throw new Error(unavailable.message);
    return nativeModule.capturePhoto();
  }, [available, nativeModule]);

  return useMemo(() => ({ available, state, connect, capturePhoto }), [available, capturePhoto, connect, state]);
}

export function SonyCameraLiveView(props: SonyLiveViewProps) {
  return <SonyCameraView {...props} />;
}
