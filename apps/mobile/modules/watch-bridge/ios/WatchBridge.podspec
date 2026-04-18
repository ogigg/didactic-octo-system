Pod::Spec.new do |s|
  s.name           = 'WatchBridge'
  s.version        = '1.0.0'
  s.summary        = 'WatchConnectivity bridge between the Sweaty phone app and watchOS companion.'
  s.description    = 'Local Expo module exposing WCSession messaging and pairing/reachability checks.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platform       = :ios, '15.1'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
