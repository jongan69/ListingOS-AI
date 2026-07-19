import { NativePullRefreshIsland } from "@/components/pull-refresh-island.native-core";
import type { PullRefreshIslandProps } from "@/components/pull-refresh-island.types";

export function PullRefreshIsland(props: PullRefreshIslandProps) {
  return <NativePullRefreshIsland {...props} variant="ios" />;
}
