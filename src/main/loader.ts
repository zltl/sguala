import conf, { confUpgrade } from "./conf";
import './main';

import { app } from 'electron';
import { initIpc } from "./initIpc";

(async () => {
  await confUpgrade();

  await conf.load();

  initIpc();

  if (process.argv.includes("--test")) {
    console.log('starting test');
    app.quit();
    require('./test');
  } else {
    console.log('starting main');
  }
})();

