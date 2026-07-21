Pod::Spec.new do |s|
  s.name           = 'SonyCamera'
  s.version        = '0.1.0'
  s.summary        = 'ListingOS Sony Camera Control PTP 2 integration'
  s.description    = 'Internal iOS ImageCaptureCore bridge for Sony camera live view and capture.'
  s.author         = 'Jonathan Gan'
  s.homepage       = 'https://github.com/jongan69'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ImageCaptureCore', 'UIKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
