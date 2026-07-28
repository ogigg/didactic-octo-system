import { StyleSheet, type ViewProps } from "react-native";

import { ThemedView } from "@/components/themed-view";

export function TabScreen({ style, ...props }: ViewProps) {
  return <ThemedView style={[styles.root, style]} {...props} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
