const { withPodfile } = require("@expo/config-plugins");

/**
 * Raises CocoaPods targets below iOS 15.1 to 15.1 in the generated Podfile.
 *
 * Xcode 27 rejects pod targets (resource bundles, aggregates) that still
 * declare deployment targets below iOS 15. The app itself already targets
 * 15.1, so this only aligns the pods with it. Living in a config plugin keeps
 * the fix when `expo prebuild --clean` (used by the fastlane lanes) regenerates
 * the Podfile.
 */
const MIN_IOS_DEPLOYMENT_TARGET = "15.1";
const BEGIN_MARKER = "# @generated begin sweaty-min-pod-deployment-target";
const END_MARKER = "# @generated end sweaty-min-pod-deployment-target";

const GENERATED_BLOCK = new RegExp(
  `\\n[ \\t]*${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}[^\\n]*`
);
// RN's post_install call closes with `)` at the same indentation it opened.
const RN_POST_INSTALL_CALL =
  /^([ \t]*)react_native_post_install\([\s\S]*?\n\1\)[ \t]*$/m;

function addMinPodDeploymentTarget(podfile) {
  const source = podfile.replace(GENERATED_BLOCK, "");
  const match = source.match(RN_POST_INSTALL_CALL);
  if (!match) {
    throw new Error(
      "with-min-pod-deployment-target: could not find react_native_post_install(...) in ios/Podfile."
    );
  }

  const indent = match[1];
  const snippet = [
    BEGIN_MARKER,
    "installer.pods_project.targets.each do |target|",
    "  target.build_configurations.each do |build_configuration|",
    `    if build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS_DEPLOYMENT_TARGET}`,
    `      build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS_DEPLOYMENT_TARGET}'`,
    "    end",
    "  end",
    "end",
    END_MARKER,
  ]
    .map((line) => `${indent}${line}`)
    .join("\n");

  const insertAt = match.index + match[0].length;
  return `${source.slice(0, insertAt)}\n${snippet}${source.slice(insertAt)}`;
}

const withMinPodDeploymentTarget = (config) =>
  withPodfile(config, (c) => {
    c.modResults.contents = addMinPodDeploymentTarget(c.modResults.contents);
    return c;
  });

module.exports = withMinPodDeploymentTarget;
module.exports.addMinPodDeploymentTarget = addMinPodDeploymentTarget;
