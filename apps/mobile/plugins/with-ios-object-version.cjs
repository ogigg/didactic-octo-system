const { withXcodeProject } = require("@expo/config-plugins");

/**
 * Forces a CocoaPods-compatible project object version for generated iOS projects.
 *
 * Some CocoaPods/xcodeproj versions fail to parse objectVersion 70 produced by
 * newer Xcode project writers. Keeping this at 76 avoids pod install failures.
 */
const IOS_OBJECT_VERSION = "76";

const withIosObjectVersion = (config) =>
  withXcodeProject(config, (c) => {
    if (c.modResults && c.modResults.hash) {
      c.modResults.hash.objectVersion = IOS_OBJECT_VERSION;
    }
    return c;
  });

module.exports = withIosObjectVersion;
