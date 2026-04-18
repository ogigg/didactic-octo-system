Pod::Spec.new do |s|
  s.name           = 'WorkoutLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'ActivityKit Live Activity bridge for the Sweaty workout flow.'
  s.description    = 'Local Expo module that starts/updates/ends the SweatyWorkoutAttributes Live Activity.'
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
