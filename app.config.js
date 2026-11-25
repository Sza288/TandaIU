const fs = require('node:fs');
const path = require('node:path');

// Determine which google‑services.json to use.
// • In local development we keep the file at the project root.
// • In an EAS build we rely on a File Environment Variable named
//   GOOGLE_SERVICES_JSON which EAS injects as an absolute path.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
  ? process.env.GOOGLE_SERVICES_JSON
  : './google-services.json';

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(fs.existsSync(path.resolve(__dirname, googleServicesFile))
      ? { googleServicesFile }
      : {}),
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-notifications',
      {
        defaultChannel: 'default',
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    ],
  ],
});
