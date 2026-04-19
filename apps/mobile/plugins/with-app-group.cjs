const { withEntitlementsPlist } = require("@expo/config-plugins");

/**
 * Adds the `group.com.ogig.sweaty` App Group to the main app's entitlements.
 *
 * The widget extension declares the matching group via its
 * `expo-target.config.json`. The shared App Group is what lets the widget's
 * App Intents push pending actions (skip rest, adjust rest, …) into a
 * UserDefaults suite that the main app drains when it next foregrounds —
 * eliminating the OpenURLIntent foreground transition.
 */
const APP_GROUP = "group.com.ogig.sweaty";

const withAppGroup = (config) =>
  withEntitlementsPlist(config, (c) => {
    const key = "com.apple.security.application-groups";
    const existing = Array.isArray(c.modResults[key]) ? c.modResults[key] : [];
    if (!existing.includes(APP_GROUP)) {
      c.modResults[key] = [...existing, APP_GROUP];
    }
    return c;
  });

module.exports = withAppGroup;
module.exports.APP_GROUP = APP_GROUP;
