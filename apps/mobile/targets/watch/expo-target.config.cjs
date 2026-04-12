/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "watch",
  deploymentTarget: "10.0",
  name: "SweatyWatch",
  bundleIdentifier: "com.ogig.sweaty.SweatyWatch",
  frameworks: ["HealthKit", "WatchConnectivity"],
  entitlements: {
    "com.apple.developer.healthkit": true,
    "com.apple.developer.healthkit.access": ["health-records"],
  },
};
