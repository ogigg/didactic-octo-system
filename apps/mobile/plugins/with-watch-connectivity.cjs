const { withEntitlementsPlist } = require("@expo/config-plugins");

/**
 * Adds the WKCompanionAppBundleIdentifier entry to the main app's
 * entitlements so iOS allows WatchConnectivity communication.
 */
const withWatchConnectivity = (config) =>
  withEntitlementsPlist(config, (c) => {
    c.modResults["com.apple.developer.watchkit"] = true;
    return c;
  });

module.exports = withWatchConnectivity;
