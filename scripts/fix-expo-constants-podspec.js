const fs = require('fs');
const path = require('path');

const podspecPath = path.join(__dirname, '..', 'node_modules', 'expo-constants', 'ios', 'EXConstants.podspec');

if (!fs.existsSync(podspecPath)) {
  console.log('[fix-expo-constants-podspec] podspec not found, skipping');
  process.exit(0);
}

const original = fs.readFileSync(podspecPath, 'utf8');
const from = ':script => "bash -l -c \\\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\"",';
const to = ':script => "bash -l -c \\\"#{env_vars}\\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\\"\\\"",';

if (original.includes(to)) {
  console.log('[fix-expo-constants-podspec] already patched');
  process.exit(0);
}

if (!original.includes(from)) {
  console.log('[fix-expo-constants-podspec] expected pattern not found, skipping');
  process.exit(0);
}

const updated = original.replace(from, to);
fs.writeFileSync(podspecPath, updated);
console.log('[fix-expo-constants-podspec] patched EXConstants.podspec');
