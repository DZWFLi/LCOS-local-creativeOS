const path = require('node:path')

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'LCOS',
    executableName: 'LCOS',
    icon: path.resolve(__dirname, 'assets', 'lcos.ico'),
    extraResource: [path.resolve(__dirname, 'resources', 'runtime')],
    ignore: [
      /^\/resources\/runtime$/,
      /^\/\.git/,
    ],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'LCOS',
        setupExe: 'LCOS-Setup.exe',
        noMsi: true,
        setupIcon: path.resolve(__dirname, 'assets', 'lcos.ico'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
}
