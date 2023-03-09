
import { SshRemote } from './sshRemote';

import { sleepAsync } from './sleepAsync';


import { getConfig, storeConf } from './conf';

async function TestConfig() {
  const c = getConfig();
  console.log("c=", JSON.stringify(c));
  console.log("TEST: ============ should print \"config file changed...\" ============");
  await storeConf(getConfig()); // should print "config file changed sguala_2.json"
  await sleepAsync(10);
}

function TestMapStruct() {
  const a = {
    a: 1,
    st: [{
      x: 1,
      y: 2,
      s: '123',
    }, {
      x: 1,
      y: 2,
      s: '123',
    }]
  };

  const m = new Map<string, any>();
  m.set("a", a.st[0]);
  m.set("b", a.st[1]);

  m.get("a").x = 2;
  if (a.st[0].x != 2) {
    console.log("ERROR: modify map not effect to struct");
  }
}

(async () => {
  await TestConfig();
  console.log("TestConfig done");
  TestMapStruct();
  console.log("TestMapStruct done");

  process.exit(0);
})();


