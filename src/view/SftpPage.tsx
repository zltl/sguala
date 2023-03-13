import React from 'react';
import { parse as queryParse } from 'querystring';
import { SftpCurPath } from './SftpCurPath';
import { Box, CssBaseline } from '@mui/material';

export function SftpPage() {
  const [uuid, setUuid] = React.useState<string>('');
  const [cnt, setCnt] = React.useState<number>(0);
  const [server, setServer] = React.useState<any>(undefined);
  const [chanKey, setChanKey] = React.useState<string>(undefined);
  const [curDir, setCurDir] = React.useState<string>('.');

  const updateCurDir = (path: string) => {
    setCurDir(path);
    sftpRealPath(path, chanKey);
  };


  const listenMsg = (chanKey: string) => {
    main.ipc.on(chanKey, (hc: string, msg: any) => {
      console.log("msg", JSON.stringify(msg));
      if (msg.op == 'transferStart') {
        console.log("transferStart", JSON.stringify(msg));
      } else if (msg.op == 'realPath') {
        console.log("realPath", JSON.stringify(msg));
        if (msg.realPath) {
          setCurDir(msg.realPath);
        }

      } else if (msg.op == 'ls') {
        console.log("ls", JSON.stringify(msg));


      } else {
        console.log("msg unkown", JSON.stringify(msg));
      }
    });
  };
  const sftpLs = async (path: string, chanKey: string) => {
    await main.ipc.send(chanKey, {
      op: 'ls',
      path: path,
    });
  };
  const sftpRealPath = async (path: string, chanKey: string) => {
    console.log("sftpRealPath", path, chanKey);
    await main.ipc.send(chanKey, {
      op: 'realPath',
      path: path,
    });
  }

  const loadServerConfStart = async (uuid: string, cnt: number, chanKey: string) => {
    const s = await main.conf.getServer(uuid);
    if (!s) {
      console.log(`Server ${uuid} not found`);
      return;
    }

    console.log(`Server ${uuid} found, ${JSON.stringify(s)}`);
    document.title = `sftp ${s.name} - ${s.username}@${s.host}:${s.port}`;

    setServer(s);
    listenMsg(chanKey);
    const res = await main.remote.sftp(uuid, cnt);
    console.log("res", JSON.stringify(res));
    console.log('sftp real-path');
    await sftpRealPath('.', chanKey);
    console.log('sftp real-path len');
    await sftpLs('.', chanKey);

    return res;
  }


  React.useEffect(() => {
    // get uuid and cnt
    const query = queryParse(global.location.search);
    const suuid = query['?uuid'] as string;
    const scnts = query['shellCnt'] as string;
    const scnt = parseInt(scnts);
    const schanKey = `SFTP_CHANNEL_${suuid}/${scnt}`;
    setChanKey(schanKey);
    setUuid(suuid);
    setCnt(scnt);

    loadServerConfStart(suuid, scnt, schanKey);

    return () => {
      main.ipc.clear(schanKey, schanKey);
    };

  }, []);


  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <CssBaseline />
      <SftpCurPath path={curDir} setPath={(p) => { updateCurDir(p) }} />

      < h2 > 123</h2>
    </Box >
  );
}
