Pod::Spec.new do |s|
  s.name           = 'HomeWidgets'
  s.version        = '1.0.0'
  s.summary        = 'Home Screen and Lock Screen widget snapshot bridge for Sweaty.'
  s.description    = 'Local Expo module that stores the widget snapshot in the shared App Group and reloads WidgetKit timelines.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platform       = :ios, '15.1'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
