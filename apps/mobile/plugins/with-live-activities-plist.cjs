const { withInfoPlist } = require("@expo/config-plugins");

/**
 * Injects NSSupportsLiveActivities = true into the main app Info.plist so
 * ActivityKit Live Activities and Dynamic Island are enabled at runtime.
 */
const withLiveActivitiesPlist = (config) =>
  withInfoPlist(config, (c) => {
    c.modResults.NSSupportsLiveActivities = true;
    c.modResults.NSSupportsLiveActivitiesFrequentUpdates = false;
    return c;
  });

module.exports = withLiveActivitiesPlist;
