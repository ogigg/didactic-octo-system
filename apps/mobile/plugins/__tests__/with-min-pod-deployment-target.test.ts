const {
  addMinPodDeploymentTarget,
} = require("../with-min-pod-deployment-target.cjs");

// Mirrors the post_install block of the Expo SDK 54 Podfile template.
const TEMPLATE_PODFILE = `target 'Sweaty' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

describe("addMinPodDeploymentTarget", () => {
  it("adds the deployment target loop right after react_native_post_install", () => {
    const result: string = addMinPodDeploymentTarget(TEMPLATE_PODFILE);

    expect(result).toContain(
      "    )\n    # @generated begin sweaty-min-pod-deployment-target\n    installer.pods_project.targets.each do |target|"
    );
    expect(result).toContain(
      "build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'"
    );
    expect(result).toMatch(
      /# @generated end sweaty-min-pod-deployment-target\n {2}end\nend\n$/
    );
  });

  it("is idempotent", () => {
    const once: string = addMinPodDeploymentTarget(TEMPLATE_PODFILE);

    expect(addMinPodDeploymentTarget(once)).toBe(once);
  });

  it("fails loudly when the template changes", () => {
    expect(() =>
      addMinPodDeploymentTarget("target 'Sweaty' do\nend\n")
    ).toThrow(/react_native_post_install/);
  });
});
