export const explore = {
  title: "Explore",
  intro: "This app includes example code to help you get started.",
  fileRouting: {
    title: "File-based routing",
    screens:
      "This app has two screens: <bold>app/(tabs)/index.tsx</bold> and <bold>app/(tabs)/explore.tsx</bold>",
    layout:
      "The layout file in <bold>app/(tabs)/_layout.tsx</bold> sets up the tab navigator.",
  },
  platformSupport: {
    title: "Android, iOS, and web support",
    description:
      "You can open this project on Android, iOS, and the web. To open the web version, press <bold>w</bold> in the terminal running this project.",
  },
  images: {
    title: "Images",
    description:
      "For static images, you can use the <bold>@2x</bold> and <bold>@3x</bold> suffixes to provide files for different screen densities",
  },
  theming: {
    title: "Light and dark mode components",
    description:
      "This template has light and dark mode support. The <bold>useColorScheme()</bold> hook lets you inspect what the user's current color scheme is, and so you can adjust UI colors accordingly.",
  },
  animations: {
    title: "Animations",
    description:
      "This template includes an example of an animated component. The <bold>components/HelloWave.tsx</bold> component uses the powerful <bold>react-native-reanimated</bold> library to create a waving hand animation.",
    parallax:
      "The <bold>components/ParallaxScrollView.tsx</bold> component provides a parallax effect for the header image.",
  },
} as const;
