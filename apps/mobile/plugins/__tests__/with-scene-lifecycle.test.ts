const {
  adoptSceneLifecycle,
  addSceneManifest,
  SCENE_DELEGATE_SWIFT,
} = require("../with-scene-lifecycle.cjs");

// Mirrors the relevant parts of the Expo SDK 54 ios/Sweaty/AppDelegate.swift.
const TEMPLATE_APP_DELEGATE = `import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe("adoptSceneLifecycle", () => {
  const result: string = adoptSceneLifecycle(TEMPLATE_APP_DELEGATE);

  it("stops the AppDelegate from creating the window and starting React Native", () => {
    expect(result).not.toContain("UIWindow(frame:");
    expect(result).not.toContain("startReactNative");
    expect(result).toContain(
      "    bindReactNativeFactory(factory)\n\n    // The UIScene lifecycle: SceneDelegate creates the window and starts React Native.\n    self.launchOptions = launchOptions\n\n    return super.application"
    );
  });

  it("keeps the launch options for the scene delegate", () => {
    expect(result).toContain(
      "  var reactNativeFactory: RCTReactNativeFactory?\n  // @generated sweaty-scene-lifecycle: SceneDelegate starts React Native with these.\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n"
    );
  });

  it("is idempotent", () => {
    expect(adoptSceneLifecycle(result)).toBe(result);
  });

  it("fails loudly when the template changes", () => {
    expect(() =>
      adoptSceneLifecycle(
        TEMPLATE_APP_DELEGATE.replace("in: window,", "in: someWindow,")
      )
    ).toThrow(/no longer matches the Expo SDK 54 template/);
  });
});

describe("addSceneManifest", () => {
  it("declares one window scene driven by SceneDelegate", () => {
    const plist = addSceneManifest({ CFBundleName: "Sweaty" });

    expect(plist.CFBundleName).toBe("Sweaty");
    expect(plist.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    });
  });
});

describe("SceneDelegate.swift", () => {
  it("starts the same React Native module the template did", () => {
    expect(TEMPLATE_APP_DELEGATE).toContain('withModuleName: "main"');
    expect(SCENE_DELEGATE_SWIFT).toContain(
      'factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)'
    );
  });

  it("forwards URLs and user activities to the AppDelegate", () => {
    expect(SCENE_DELEGATE_SWIFT).toContain(
      "func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>)"
    );
    expect(SCENE_DELEGATE_SWIFT).toContain(
      "func scene(_ scene: UIScene, continue userActivity: NSUserActivity)"
    );
    expect(SCENE_DELEGATE_SWIFT).toContain(
      "connectionOptions.urlContexts.first?.url"
    );
    expect(SCENE_DELEGATE_SWIFT).toContain(
      "connectionOptions.userActivities.first"
    );
  });
});
