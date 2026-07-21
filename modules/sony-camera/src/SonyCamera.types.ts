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

export type SonyCameraInfo = {
  vendorId: number;
  productId: number;
  deviceName: string;
  manufacturerName?: string;
  productName?: string;
  model: string;
  protocol: "sony_camera_control_ptp2";
};

export type SonyCameraState = {
  state: SonyCameraStateName;
  message?: string;
  device?: SonyCameraInfo;
  diagnostics?: string[];
};

export type SonyPhoto = {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: "image/jpeg";
};

export type SonyCameraModuleEvents = {
  onStateChanged: (state: SonyCameraState) => void;
  onDeviceAttached: (state: SonyCameraState) => void;
  onPhotoCaptured: (photo: SonyPhoto) => void;
};

export type SonyCameraViewProps = {
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};
