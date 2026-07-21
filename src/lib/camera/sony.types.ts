import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type SonyCameraStateName =
  | "unsupported"
  | "disconnected"
  | "permission_required"
  | "connecting"
  | "ready"
  | "streaming"
  | "capturing"
  | "error";

export type SonyCameraState = {
  state: SonyCameraStateName;
  message?: string;
  diagnostics?: string[];
  device?: {
    vendorId: number;
    productId: number;
    deviceName: string;
    model: string;
    protocol: "sony_camera_control_ptp2";
  };
};

export type SonyPhoto = {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: "image/jpeg";
};

export type SonyCameraConnection = {
  available: boolean;
  state: SonyCameraState;
  connect: () => Promise<SonyCameraState>;
  capturePhoto: () => Promise<SonyPhoto>;
};

export type SonyLiveViewProps = { active: boolean; style?: StyleProp<ViewStyle> };
export type SonyLiveViewComponent = ComponentType<SonyLiveViewProps>;
