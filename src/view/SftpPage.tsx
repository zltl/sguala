import React from 'react';
import { parse as queryParse } from 'querystring';
import { SftpCurPath } from './SftpCurPath';
import { CssBaseline } from '@mui/material';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import InboxIcon from '@mui/icons-material/Inbox';
import DraftsIcon from '@mui/icons-material/Drafts';
import { humanFileSize } from './humanSize';
import FolderIcon from '@mui/icons-material/Folder';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import { grey } from '@mui/material/colors';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';

import { useTranslation } from 'react-i18next';
import { SftpProgress } from './SftpProgress';

let chanKey = '';

export function SftpPage() {
  const [uuid, setUuid] = React.useState<string>('');
  const [cnt, setCnt] = React.useState<number>(0);
  const [server, setServer] = React.useState<any>(undefined);
  const [curDir, setCurDir] = React.useState<string>('.');
  const [fileList, setFileList] = React.useState<any[]>([]);

  const [transferList, setTransferList] = React.useState<any[]>([]);

  const [t, i18n] = useTranslation();

  const updateCurDir = async (path: string) => {
    if (path.startsWith('//')) {
      path = path.substring(1);
    }

    setCurDir(path);
    if (!path.startsWith('/')) {
      await sftpRealPath(path);
    }
  };
  const sftpLs = async (path: string) => {
    console.log("sftpLs", path, "ck=", chanKey);
    await main.ipc.send(chanKey, {
      op: 'ls',
      path: path,
    });
  };

  React.useEffect(() => {
    sftpLs(curDir);
  }, [curDir]);

  const sftpRealPath = async (path: string) => {
    console.log("sftpRealPath", path);
    await main.ipc.send(chanKey, {
      op: 'realPath',
      path: path,
    });
  }

  const listenMsg = () => {
    main.ipc.on(chanKey, (hc: string, msg: any) => {
      console.log("msg", JSON.stringify(msg));
      if (msg.op == 'transferStart') {
        console.log("transferStart", JSON.stringify(msg));
        setTransferList((old) => [...old, msg]);
      } else if (msg.op == 'realPath') {
        console.log("realPath", JSON.stringify(msg));
        if (msg.realPath) {
          updateCurDir(msg.realPath);
        }

      } else if (msg.op == 'ls') {
        console.log("ls", JSON.stringify(msg));
        if (msg.err) {
          console.log("ls err", JSON.stringify(msg.err));
          // TODO
          return;
        }
        setFileList(msg.list);
      } else {
        console.log("msg unkown", JSON.stringify(msg));
      }
    });
  };

  const progListEl = transferList.map((t) => {
    return (
      <ListItem key={t.uuid}>
        <SftpProgress uuid={t.uuid} remote={t.remoteFullPath} local={t.localFullPath} dir={t.transferType} />
      </ListItem>
    );
  });

  const loadServerConfStart = async (uuid: string, cnt: number) => {
    const s = await main.conf.getServer(uuid);
    if (!s) {
      console.log(`Server ${uuid} not found`);
      return;
    }

    console.log(`Server ${uuid} found, ${JSON.stringify(s)}`);
    document.title = `sftp ${s.name} - ${s.username}@${s.host}:${s.port}`;

    setServer(s);
    listenMsg();
    const res = await main.remote.sftp(uuid, cnt);
    console.log("res", JSON.stringify(res));
    console.log('sftp real-path');
    await sftpRealPath(curDir);
    console.log('sftp real-path len');

    return res;
  }

  const getF = async (f: any) => {
    await main.ipc.send(chanKey, {
      op: 'get',
      remoteF: f,
    });
  };

  const putF = async () => {
    await main.ipc.send(chanKey, {
      op: 'put',
      remotePath: curDir,
    });
  }

  React.useEffect(() => {
    // get uuid and cnt
    const query = queryParse(global.location.search);
    const suuid = query['?uuid'] as string;
    const scnts = query['shellCnt'] as string;
    const scnt = parseInt(scnts);
    const schanKey = `SFTP_CHANNEL_${suuid}/${scnt}`;
    chanKey = schanKey;
    setUuid(suuid);
    setCnt(scnt);

    loadServerConfStart(suuid, scnt);

    return () => {
      main.ipc.clear(schanKey, schanKey);
    };

  }, []);

  const flistElem = fileList.map((f) => {
    let icon = <TextSnippetIcon />;
    if (f.isDir) {
      icon = <FolderIcon color='primary' />;
    }

    return (
      <ListItem key={f.name} >
        <Grid container spacing={2} className="hoverGrey" >
          <Grid item xs={1} onClick={() => {
            if (f.isDir) {
              updateCurDir(curDir + '/' + f.name);
            }
          }}>
            {icon}
          </Grid>
          <Grid item xs={3} onClick={() => {
            if (f.isDir) {
              updateCurDir(curDir + '/' + f.name);
            }
          }}>
            <Typography color={f.isDir ? "primary.main" : "text.default"} variant="body2" sx={{ ml: 1 }}>
              {f.name}
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="body2" sx={{ ml: 1 }}>
              {f.isDir ? '' : humanFileSize(f.size)}
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="body2" sx={{ ml: 1 }}>
              {f.mtime}
            </Typography>
          </Grid>

          <ListItemButton onClick={() => {
            getF(f);
          }}>
            <DownloadIcon />
          </ListItemButton>
        </Grid>
      </ListItem>
    );
  });

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <CssBaseline />
      <SftpCurPath path={curDir} setPath={(p) => { updateCurDir(p) }} />
      <Button variant="outlined" sx={{ marginLeft: '2' }} startIcon={<UploadIcon />}
        onClick={() => { putF() }}>
        {t('Upload')}
      </Button>
      <Divider />
      <Box sx={{ height: '60%', overflow: 'auto' }}>
        <List>
          {flistElem}
        </List>
      </Box>
      <Divider />
      <Box sx={{ height: '30%', width: '100%', overflow: 'auto' }}>
        <List sx={{ width: '100%' }}>
          {progListEl}
        </List>
      </Box>
    </Box>
  );
}
