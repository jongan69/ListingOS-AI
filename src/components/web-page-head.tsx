import Head from "expo-router/head";
import { Platform } from "react-native";

type WebPageHeadProps = {
  description?: string;
  title: string;
  indexable?: boolean;
};

export function WebPageHead({ description, indexable = false, title }: WebPageHeadProps) {
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <Head>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta name="robots" content={indexable ? "index,follow" : "noindex,nofollow"} />
    </Head>
  );
}
