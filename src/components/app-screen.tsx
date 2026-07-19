import { createContext, type PropsWithChildren, type ReactNode, use, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { PullRefreshIsland } from "@/components/pull-refresh-island";
import { ScreenBackground } from "@/components/screen-background";
import { type Palette } from "@/theme/palette";
import { usePalette } from "@/theme/theme";

const MAX_CONTENT_WIDTH = 900;
const KEYBOARD_ACCESSORY_CLEARANCE = 72;
const InputFocusContext = createContext<(target: number) => void>(() => {});

export function AppTextInput({ onFocus, ...props }: TextInputProps) {
  const revealInput = use(InputFocusContext);

  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        revealInput(event.nativeEvent.target);
        onFocus?.(event);
      }}
    />
  );
}

export function AppScreen({
  children,
  keyboardAware = false,
  footer,
  onRefresh,
}: PropsWithChildren<{ keyboardAware?: boolean; footer?: ReactNode; onRefresh?: () => Promise<void> | void }>) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { width } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const horizontalPadding = width < 360 ? 12 : width < 600 ? 18 : 28;
  const bottomPadding = Math.max(insets.bottom, 16) + (footer ? 122 : 32);

  useEffect(() => {
    if (!keyboardAware) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardAware]);

  function revealFocusedInput(target: number) {
    if (!keyboardAware) return;
    const reveal = () => {
      scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 28, true);
    };
    const revealFully = () => {
      const keyboard = Keyboard.metrics();
      if (!keyboard) return;
      UIManager.measureInWindow(target, (_x, y, _width, height) => {
        const overlap = y + height - (keyboard.screenY - KEYBOARD_ACCESSORY_CLEARANCE);
        if (overlap <= 0) return;
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + overlap),
          animated: true,
        });
      });
    };
    requestAnimationFrame(reveal);
    setTimeout(reveal, 350);
    setTimeout(revealFully, 550);
  }

  return (
    <View role="main" style={styles.screen}>
      <ScreenBackground />
      {onRefresh ? (
        // PullRefreshIsland draws its Skia canvas from the true screen
        // origin so the resting "island" shape can align with the real
        // Dynamic Island. It must NOT sit inside a top-edge SafeAreaView,
        // or that view's own top inset stacks with the insets.top math
        // inside the component and the shape renders far below where it
        // should. Safe-area compensation happens via contentContainerStyle
        // paddingTop below instead.
        <KeyboardAvoidingView
          behavior={keyboardAware && Platform.OS === "ios" ? "padding" : undefined}
          enabled={keyboardAware}
          style={styles.screen}
        >
          <PullRefreshIsland
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: insets.top + 12,
                paddingHorizontal: horizontalPadding,
                paddingBottom: bottomPadding,
              },
            ]}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            onRefresh={onRefresh}
            onScrollOffsetChange={(offsetY) => {
              scrollOffsetRef.current = offsetY;
            }}
            scrollRef={scrollViewRef}
          >
            <InputFocusContext value={revealFocusedInput}>
              {children}
            </InputFocusContext>
          </PullRefreshIsland>
          {footer && !keyboardVisible ? (
            <View
              style={[
                styles.footer,
                {
                  paddingHorizontal: horizontalPadding,
                  paddingBottom: Math.max(insets.bottom, 10),
                },
              ]}
            >
              <View style={styles.footerContent}>{footer}</View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      ) : (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={keyboardAware && Platform.OS === "ios" ? "padding" : undefined}
          enabled={keyboardAware}
          style={styles.screen}
        >
            <ScrollView
              automaticallyAdjustKeyboardInsets={keyboardAware}
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={[
                styles.content,
                {
                  paddingHorizontal: horizontalPadding,
                  paddingBottom: bottomPadding,
                },
              ]}
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              keyboardShouldPersistTaps="handled"
              onScroll={(event) => {
                scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              ref={scrollViewRef}
              scrollEventThrottle={16}
              style={styles.screen}
            >
              <InputFocusContext value={revealFocusedInput}>
                {children}
              </InputFocusContext>
            </ScrollView>
          {footer && !keyboardVisible ? (
            <View
              style={[
                styles.footer,
                {
                  paddingHorizontal: horizontalPadding,
                  paddingBottom: Math.max(insets.bottom, 10),
                },
              ]}
            >
              <View style={styles.footerContent}>{footer}</View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
      )}
    </View>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    paddingTop: 12,
    gap: 18,
  },
  footer: {
    paddingTop: 12,
    backgroundColor: palette.cardStrong,
    borderTopWidth: 1,
    borderTopColor: palette.borderStrong,
  },
  footerContent: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
  },
});
