const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude react-native-maps pnpm post-install tmp dirs from Metro's file watcher.
// These directories are created during install then cleaned up, causing ENOENT errors.
config.resolver = config.resolver ?? {};
config.resolver.blockList = [/react-native-maps_tmp_\d+\//];

module.exports = config;
