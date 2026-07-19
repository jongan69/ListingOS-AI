declare module "*.png" {
  import type { ImageSourcePropType } from "react-native";

  const source: ImageSourcePropType;
  export default source;
}

declare module "*.jpg" {
  const source: number;
  export default source;
}

declare module "*.onnx" {
  const asset: number;
  export default asset;
}
