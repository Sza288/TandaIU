#!/usr/bin/env node

/**
 * Reset the project to a blank Expo Router screen. This is an optional starter-template utility;
 * do not run it when you want to keep the current TandaIU implementation.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const root = process.cwd();
const oldDirs = ['src', 'scripts'];
const exampleDir = 'example';
const newAppDir = 'src/app';
const exampleDirPath = path.join(root, exampleDir);
const exampleAssets = [
  'expo-badge.png',
  'expo-badge-white.png',
  'expo-logo.png',
  'logo-glow.png',
  'react-logo.png',
  'react-logo@2x.png',
  'react-logo@3x.png',
  'tutorial-web.png',
  'tabIcons',
];
const indexContent = `import { Text, View, StyleSheet } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text>Edit src/app/index.tsx to edit this screen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
`;
const layoutContent = `import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
`;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function moveDirectories(userInput) {
  if (userInput !== 'y') {
    console.log('Reset canceled. The project was not changed.');
    return;
  }

  try {
    if (fs.existsSync(exampleDirPath)) {
      throw new Error(`/${exampleDir} already exists. Move or rename it before resetting.`);
    }

    await fs.promises.mkdir(path.join(exampleDirPath, 'assets/images'), { recursive: true });
    console.log(`📁 /${exampleDir} directory created.`);

    for (const dir of oldDirs) {
      const oldDirPath = path.join(root, dir);
      if (!fs.existsSync(oldDirPath)) continue;
      await fs.promises.rename(oldDirPath, path.join(root, exampleDir, dir));
      console.log(`➡️ /${dir} moved to /${exampleDir}/${dir}.`);
    }

    for (const asset of exampleAssets) {
      const assetPath = path.join(root, 'assets/images', asset);
      if (!fs.existsSync(assetPath)) continue;
      await fs.promises.rename(assetPath, path.join(exampleDirPath, 'assets/images', asset));
    }

    const newAppDirPath = path.join(root, newAppDir);
    await fs.promises.mkdir(newAppDirPath, { recursive: true });
    await fs.promises.writeFile(path.join(newAppDirPath, 'index.tsx'), indexContent);
    await fs.promises.writeFile(path.join(newAppDirPath, '_layout.tsx'), layoutContent);
    console.log('Project reset complete. Run npx expo start to start the development server.');
  } catch (error) {
    console.error(`Error during reset: ${error.message}`);
    process.exitCode = 1;
  }
}

rl.question('Move the existing implementation to /example before resetting? (y/N): ', (answer) => {
  const input = answer.trim().toLowerCase();
  if (input === 'y' || input === 'n') {
    moveDirectories(input).finally(() => rl.close());
  } else if (input === '') {
    moveDirectories('n').finally(() => rl.close());
  } else {
    console.log("Please enter 'y' or 'n'.");
    rl.close();
  }
});
