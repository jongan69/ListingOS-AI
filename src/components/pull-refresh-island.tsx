import { Platform } from "react-native";

import { PullRefreshIsland as AndroidPullRefreshIsland } from "@/components/pull-refresh-island.android";
import { PullRefreshIsland as IosPullRefreshIsland } from "@/components/pull-refresh-island.ios";
import type { PullRefreshIslandProps } from "@/components/pull-refresh-island.types";
import { PullRefreshIsland as WebPullRefreshIsland } from "@/components/pull-refresh-island.web";

export function PullRefreshIsland(props: PullRefreshIslandProps) {
  if (Platform.OS === "web") return <WebPullRefreshIsland {...props} />;
  if (Platform.OS === "ios") return <IosPullRefreshIsland {...props} />;
  return <AndroidPullRefreshIsland {...props} />;
}
