import { Redirect } from "expo-router";
/** Strength levels remain available in profile settings, outside initial setup. */
export default function LegacyStrengthScreen() {
  return <Redirect href="/(onboarding)/frequency" />;
}
