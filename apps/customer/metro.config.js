const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    // Disable Watchman when it fails with "Operation not permitted" (e.g. in Documents folder)
    useWatchman: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
