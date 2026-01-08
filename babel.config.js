module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Required for Reanimated to work (SharedValues, worklets)
            'react-native-reanimated/plugin',
        ],
    };
};
