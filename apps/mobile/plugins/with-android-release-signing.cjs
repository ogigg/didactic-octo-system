const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Signs Android release builds with the Play upload key and lets fastlane set
 * versionCode, in the generated android/app/build.gradle.
 *
 * The upload key comes from SWEATY_UPLOAD_STORE_FILE, SWEATY_UPLOAD_STORE_PASSWORD,
 * SWEATY_UPLOAD_KEY_ALIAS and SWEATY_UPLOAD_KEY_PASSWORD, or else from the
 * git-ignored fastlane/keystore.properties (see keystore.properties.example).
 * Without any of them, release builds keep the template's debug signing so
 * local `expo run:android --variant release` still works; the fastlane lanes
 * refuse to build or upload in that case. A partial config or a missing
 * keystore also falls back to debug signing, with a warning, so debug builds
 * keep working while the release credentials are being set up.
 *
 * `-Psweaty.versionCode=<n>` (passed by the fastlane lanes) overrides the
 * versionCode Expo writes from app.json.
 */
const MARKER = "sweaty-release-signing";

// Inserted before `android {`. It must not mention the version code property
// by name: Expo's version mod rewrites the first line that does.
const SIGNING_HELPER = `// @generated begin ${MARKER} (plugins/with-android-release-signing.cjs)
def sweatyUploadSigning = { ->
    def propsFile = new File(projectRoot, "fastlane/keystore.properties")
    def props = new Properties()
    if (propsFile.exists()) {
        propsFile.withInputStream { props.load(it) }
    }
    def read = { String envName, String propName ->
        def fromEnv = System.getenv(envName)
        def value = (fromEnv != null && !fromEnv.trim().isEmpty()) ? fromEnv : props.getProperty(propName)
        return value != null && !value.trim().isEmpty() ? value.trim() : null
    }
    def config = [
        storeFile: read("SWEATY_UPLOAD_STORE_FILE", "storeFile"),
        storePassword: read("SWEATY_UPLOAD_STORE_PASSWORD", "storePassword"),
        keyAlias: read("SWEATY_UPLOAD_KEY_ALIAS", "keyAlias"),
        keyPassword: read("SWEATY_UPLOAD_KEY_PASSWORD", "keyPassword"),
    ]
    def missing = config.findAll { it.value == null }.keySet()
    if (missing.size() == config.size()) {
        return null
    }
    if (!missing.isEmpty()) {
        logger.warn("Android upload key config is incomplete (missing " + missing.join(", ") +
            "); release builds use the debug key. Set SWEATY_UPLOAD_* or fill fastlane/keystore.properties.")
        return null
    }
    def keystore = new File(config.storeFile)
    if (!keystore.isAbsolute()) {
        keystore = new File(propsFile.getParentFile(), config.storeFile)
    }
    if (!keystore.exists()) {
        logger.warn("Android upload keystore not found: " + keystore + "; release builds use the debug key.")
        return null
    }
    config.storeFile = keystore
    return config
}()
// @generated end ${MARKER}
`;

const RELEASE_SIGNING_CONFIG = (indent) =>
  [
    `// @generated begin ${MARKER}`,
    "if (sweatyUploadSigning != null) {",
    "    release {",
    "        storeFile sweatyUploadSigning.storeFile",
    "        storePassword sweatyUploadSigning.storePassword",
    "        keyAlias sweatyUploadSigning.keyAlias",
    "        keyPassword sweatyUploadSigning.keyPassword",
    "    }",
    "}",
    `// @generated end ${MARKER}`,
  ]
    .map((line) => `${indent}${line}`)
    .join("\n");

const VERSION_CODE_OVERRIDE = (indent) =>
  [
    `// @generated begin ${MARKER}: fastlane passes -Psweaty.versionCode`,
    'if (findProperty("sweaty.versionCode")) {',
    '    versionCode findProperty("sweaty.versionCode").toString().toInteger()',
    "}",
    `// @generated end ${MARKER}`,
  ]
    .map((line) => `${indent}${line}`)
    .join("\n");

const ANDROID_BLOCK = /^android\s*\{/m;
const VERSION_CODE_LINE = /^([ \t]*)versionCode\s+\d+[^\n]*\n/m;
// The template's debug block contains no nested braces.
const DEBUG_SIGNING_CONFIG =
  /^([ \t]*)signingConfigs\s*\{[ \t]*\n([ \t]*)debug\s*\{[^{}]*\}[ \t]*\n/m;
const RELEASE_USES_DEBUG_SIGNING =
  /(\n[ \t]*release\s*\{[^{}]*?)signingConfig\s+signingConfigs\.debug/;

function replaceOnce(source, pattern, replacer, description) {
  if (!pattern.test(source)) {
    throw new Error(
      `with-android-release-signing: could not find ${description} in android/app/build.gradle.`
    );
  }
  return source.replace(pattern, replacer);
}

function addReleaseSigning(buildGradle) {
  if (buildGradle.includes(`@generated begin ${MARKER}`)) {
    return buildGradle;
  }

  let result = replaceOnce(
    buildGradle,
    ANDROID_BLOCK,
    (match) => `${SIGNING_HELPER}\n${match}`,
    "the android { block"
  );
  result = replaceOnce(
    result,
    VERSION_CODE_LINE,
    (match, indent) => `${match}${VERSION_CODE_OVERRIDE(indent)}\n`,
    "defaultConfig versionCode"
  );
  result = replaceOnce(
    result,
    DEBUG_SIGNING_CONFIG,
    (match, _outerIndent, innerIndent) =>
      `${match}${RELEASE_SIGNING_CONFIG(innerIndent)}\n`,
    "signingConfigs { debug { ... } }"
  );

  const buildTypesStart = result.search(/^[ \t]*buildTypes\s*\{/m);
  if (buildTypesStart === -1) {
    throw new Error(
      "with-android-release-signing: could not find buildTypes { in android/app/build.gradle."
    );
  }
  const head = result.slice(0, buildTypesStart);
  const buildTypes = replaceOnce(
    result.slice(buildTypesStart),
    RELEASE_USES_DEBUG_SIGNING,
    (_match, releaseStart) =>
      `${releaseStart}signingConfig(sweatyUploadSigning != null ? signingConfigs.release : signingConfigs.debug)`,
    "buildTypes.release signingConfig signingConfigs.debug"
  );
  return head + buildTypes;
}

const withAndroidReleaseSigning = (config) =>
  withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== "groovy") {
      throw new Error(
        "with-android-release-signing: expected a Groovy android/app/build.gradle."
      );
    }
    c.modResults.contents = addReleaseSigning(c.modResults.contents);
    return c;
  });

module.exports = withAndroidReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
