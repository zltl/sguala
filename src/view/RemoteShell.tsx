import React from 'react';
import { Box } from '@mui/system';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { parse as queryParse } from 'querystring';

import "../xterm.css";
import { ListItem } from '@mui/material';

export function RemoteShell() {

  const [chanKey, setChanKey] = React.useState<string>(undefined);
  const [uuid, setUuid] = React.useState<string>(undefined);
  const [cnt, setCnt] = React.useState<number>(undefined);
  const [server, setServer] = React.useState<any>(undefined);

  const xtermDiv = React.createRef<HTMLDivElement>();

  const fitAddon = new FitAddon();
  const term = new Terminal();
  term.loadAddon(fitAddon);

  const loadServerConfStart = async (uuid: string, cnt: number) => {
    const s = await main.conf.getServer(uuid);
    if (!s) {
      console.log(`Server ${uuid} not found`);
      return;
    }

    console.log(`Server ${uuid} found, ${JSON.stringify(s)}`);
    document.title = `${s.name} - ${s.username}@${s.host}:${s.port}`;

    setServer(s);
    const res = await main.remote.shell(uuid, cnt);
    console.log("res", JSON.stringify(res));
    return res;
  }

  React.useEffect(() => {
    // get uuid and cnt
    const query = queryParse(global.location.search);
    const suuid = query['?uuid'] as string;
    const scnts = query['shellCnt'] as string;
    const scnt = parseInt(scnts);
    const schanKey = `SHELL_CHANNEL_${suuid}/${scnt}`;
    setChanKey(schanKey);
    setUuid(suuid);
    setCnt(scnt);

    term.open(xtermDiv.current);
    term.onResize((arg1) => {
      console.log("onResize", arg1);
      main.ipc.send(schanKey, {
        'op': 'resize',
        'data': '',
        'rows': arg1.rows,
        'cols': arg1.cols,
      });
    });

    term.onSelectionChange(async () => {
      console.log('onSelectionChange');
      const selectedText = term.getSelection();
      console.log('selectedText', selectedText);
      if (selectedText && selectedText.length > 0) {
        console.log("selectedText=", selectedText);
        await window.navigator.clipboard.writeText(selectedText);
      }
    })

    window.addEventListener('contextmenu', async () => {
      console.log('rightclick');
      const clipboard = await window.navigator.clipboard.readText();
      console.log("clipboard=", clipboard);
      main.ipc.send(schanKey, {
        'op': 'data',
        'data': clipboard,
      });
    });


    window.addEventListener('resize', () => {
      fitAddon.fit();
    });
    fitAddon.fit();

    term.onData(async (data) => {
      main.ipc.send(schanKey, {
        'op': 'data',
        'data': data.toString(),
      });
    });

    main.ipc.on(schanKey, (event: any, data: any) => {
      if (data.op === "data") {
        term.write(data.data);
      }
    });


    loadServerConfStart(suuid, scnt);

    return () => {
      main.ipc.clear(schanKey);
    };

  }, []);

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <div ref={xtermDiv} id="xterm-x" style={{ margin: 0, height: '100%', width: '100%' }}></div>
    </Box >
  );
}
