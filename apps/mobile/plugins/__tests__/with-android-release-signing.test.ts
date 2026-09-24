const { addReleaseSigning } = require("../with-android-release-signing.cjs");

// Mirrors the relevant parts of the Expo SDK 54 android/app/build.gradle template.
const TEMPLATE_BUILD_GRADLE = `apply plugin: "com.android.application"

def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

android {
    namespace "com.ogig.sweaty"
    defaultConfig {
        applicationId "com.ogig.sweaty"
        versionCode 1
        versionName "1.2.0"
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe("addReleaseSigning", () => {
  const result: string = addReleaseSigning(TEMPLATE_BUILD_GRADLE);

  it("resolves the upload key before the android block", () => {
    expect(result.indexOf("def sweatyUploadSigning")).toBeLessThan(
      result.indexOf("android {")
    );
    expect(result).toContain("System.getenv(envName)");
    expect(result).toContain('"fastlane/keystore.properties"');
  });

  it("adds a release signing config after the debug one", () => {
    expect(result).toMatch(
      /keyPassword 'android'\n {8}\}\n {8}\/\/ @generated begin sweaty-release-signing\n {8}if \(sweatyUploadSigning != null\) \{\n {12}release \{/
    );
  });

  it("signs release builds with the upload key when configured", () => {
    expect(result).toContain(
      "signingConfig(sweatyUploadSigning != null ? signingConfigs.release : signingConfigs.debug)"
    );
    expect(result).toMatch(
      /debug \{\n {12}signingConfig signingConfigs\.debug\n {8}\}/
    );
  });

  it("lets fastlane override versionCode after the app.json value", () => {
    expect(result).toMatch(
      /versionCode 1\n {8}\/\/ @generated begin sweaty-release-signing: fastlane passes -Psweaty\.versionCode\n {8}if \(findProperty\("sweaty\.versionCode"\)\) \{/
    );
  });

  it("keeps the helper free of the word Expo's version mod matches", () => {
    const helper = result.slice(0, result.indexOf("android {"));

    expect(helper).not.toMatch(/versionCode|versionName/);
  });

  it("is idempotent", () => {
    expect(addReleaseSigning(result)).toBe(result);
  });

  it("fails loudly when the template changes", () => {
    expect(() =>
      addReleaseSigning(
        TEMPLATE_BUILD_GRADLE.replace(
          "signingConfig signingConfigs.debug\n            minifyEnabled",
          "minifyEnabled"
        )
      )
    ).toThrow(/buildTypes\.release signingConfig/);
  });
});
