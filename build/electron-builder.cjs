module.exports = {
  appId: 'cn.workstation.desktop', productName: 'Work Station',
  directories: { output: 'release' }, asar: true,
  files: ['dist/main/**', 'dist/preload/**', 'dist/shared/**', 'dist/renderer/**', 'dist/resources.json', 'package.json'],
  extraResources: [{ from: 'THIRD_PARTY_NOTICES.md', to: 'THIRD_PARTY_NOTICES.md' }, { from: 'licenses', to: 'licenses' }],
  win: { target: ['nsis', 'portable'], requestedExecutionLevel: 'asInvoker', signExecutable: false },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true },
  electronFuses: { runAsNode: false, enableNodeOptionsEnvironmentVariable: false, enableNodeCliInspectArguments: false, enableEmbeddedAsarIntegrityValidation: true, onlyLoadAppFromAsar: true },
  publish: null, npmRebuild: false
};
