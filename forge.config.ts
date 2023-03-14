import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    icon: './src/icon',
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({
    iconUrl: './src/icon.ico',
    setupIcon: './src/icon.ico',
  }), new MakerZIP({}, ['darwin']), new MakerRpm({
    options: {
      icon: './src/icon.png',
    },
  }), new MakerDeb({
    options: {
      icon: './src/icon.png',
    },
  })],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/term.html',
            js: './src/termRenderer.ts',
            name: 'shell_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/sftp.html',
            js: './src/sftpRenderer.ts',
            name: 'sftp_window',
            preload: {
              js: './src/preload.ts',
            },
          }
        ],
      },
    }),
  ],
};

export default config;
