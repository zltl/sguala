import conf, { confUpgrade } from "./conf";
import './main';

import { app } from 'electron';
import { initIpc } from "./initIpc";

(async () => {
  if (process.argv.includes("--test")) {
    await confUpgrade();
    await conf.load();
    initIpc();
  
    console.log('starting test');
    app.quit();
    require('./test');
  } else {
    console.log('starting main');
  }
})();

