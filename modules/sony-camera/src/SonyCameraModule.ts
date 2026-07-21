import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  SonyCameraModuleEvents,
  SonyCameraState,
  SonyPhoto,
} from "./SonyCamera.types";

declare class SonyCameraNativeModule extends NativeModule<SonyCameraModuleEvents> {
  getState(): SonyCameraState;
  connect(): Promise<SonyCameraState>;
  disconnect(): Promise<SonyCameraState>;
  startLiveView(): Promise<SonyCameraState>;
  stopLiveView(): Promise<SonyCameraState>;
  capturePhoto(): Promise<SonyPhoto>;
}

export default requireOptionalNativeModule<SonyCameraNativeModule>("SonyCamera");
