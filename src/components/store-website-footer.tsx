import { Link, type Href } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";

import { usePalette } from "@/theme/theme";

type FooterLink = { href: Href; label: string };

const FOOTER_LINKS: FooterLink[] = [
  { href: "/", label: "Home" },
  { href: "/app-support", label: "Support" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function StoreWebsiteFooter() {
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  if (Platform.OS !== "web") return null;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>ListingOS AI</Text>
      <Text style={styles.subtitle}>AI listings from product photos</Text>
      <View style={styles.row}>
        {FOOTER_LINKS.map((link) => (
          <Link href={link.href} key={link.label} style={styles.link}>
            {link.label}
          </Link>
        ))}
      </View>
    </View>
  );
}

function createStyles(palette: { border: string; text: string; textMuted: string; cyan: string }) {
  return StyleSheet.create({
    wrapper: {
      marginTop: 14,
      paddingVertical: 12,
      gap: 8,
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    title: {
      color: palette.text,
      fontSize: 15,
      fontWeight: "700",
    },
    subtitle: {
      color: palette.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 14,
      marginTop: 2,
    },
    link: {
      color: palette.cyan,
      fontSize: 14,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
  });
}
