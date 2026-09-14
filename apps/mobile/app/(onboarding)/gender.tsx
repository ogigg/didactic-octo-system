import { Redirect } from "expo-router";
/** Old links resume at the first required question. Gender is no longer collected. */
export default function LegacyGenderScreen() {
  return <Redirect href="/(onboarding)/goal" />;
}
