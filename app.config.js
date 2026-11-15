const fs = require('node:fs');
const path = require('node:path');

const googleServicesFile = './google-services.json';

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(fs.existsSync(path.resolve(__dirname, googleServicesFile))
      ? { googleServicesFile }
      : {}),
  },
});
