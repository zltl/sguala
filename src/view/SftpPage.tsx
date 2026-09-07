import React from 'react';
import { parse as queryParse } from 'querystring';
import { SftpCurPath } from './SftpCurPath';
import { CssBaseline } from '@mui/material';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Divider from '@mui/material/Divider';
import { humanFileSize } from './humanSize';
import FolderIcon from '@mui/icons-material/Folder';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';

import { useTranslation } from 'react-i18next';
import { SftpProgress } from './SftpProgress';

let chanKey = '';

export function SftpPage() {
  const [curDir, setCurDir] = React.useState<string>('.');
  const [fileList, setFileList] = React.useState<any[]>([]);
  const [transferList, setTransferList] = React.useState<any[]>([]);
  const [opError, setOpError] = React.useState<string>('');

  const [t] = useTranslation();

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
    await main.ipc.send(chanKey, {
      op: 'ls',
      path: path,
    });
  };

  React.useEffect(() => {
    if (chanKey) {
      sftpLs(curDir);
    }
  }, [curDir]);

  const sftpRealPath = async (path: string) => {
    await main.ipc.send(chanKey, {
      op: 'realPath',
      path: path,
    });
  };

  const listenMsg = () => {
    main.ipc.on(chanKey, (hc: string, msg: any) => {
      if (msg.op == 'transferStart') {
        setTransferList((old) => [...old, msg]);
      } else if (msg.op == 'realPath') {
        if (msg.realPath) {
          updateCurDir(msg.realPath);
        }
      } else if (msg.op == 'ls') {
        if (msg.err) {
          setOpError(msg.err);
          return;
        }
        setOpError('');
        setFileList(msg.list);
      } else if (msg.op == 'mkdir' || msg.op == 'rm' || msg.op == 'rename') {
        if (msg.err) {
          setOpError(msg.err);
        } else {
          setOpError('');
          sftpLs(curDir);
        }
      }
    });
  };

  const progListEl = transferList.map((tr) => {
    return (
      <ListItem key={tr.uuid}>
        <SftpProgress uuid={tr.uuid} remote={tr.remoteFullPath} local={tr.localFullPath} dir={tr.transferType} />
      </ListItem>
    );
  });

  const loadServerConfStart = async (serverUuid: string, shellCnt: number) => {
    const s = await main.conf.getServer(serverUuid);
    if (!s) {
      return;
    }

    document.title = `sftp ${s.name} - ${s.username}@${s.host}:${s.port}`;

    listenMsg();
    await main.remote.sftp(serverUuid, shellCnt);
    await sftpRealPath(curDir);
  };

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
  };

  const mkdirF = async () => {
    const name = window.prompt(t('New folder name'));
    if (!name || !name.trim()) {
      return;
    }
    const path = curDir.replace(/\/$/, '') + '/' + name.trim();
    await main.ipc.send(chanKey, {
      op: 'mkdir',
      path,
    });
  };

  const renameF = async (f: any) => {
    const name = window.prompt(t('Rename to'), f.name);
    if (!name || !name.trim() || name.trim() === f.name) {
      return;
    }
    const to = curDir.replace(/\/$/, '') + '/' + name.trim();
    await main.ipc.send(chanKey, {
      op: 'rename',
      from: f.fullPath,
      to,
    });
  };

  const rmF = async (f: any) => {
    const ok = window.confirm(t('Delete confirm', { name: f.name }));
    if (!ok) {
      return;
    }
    await main.ipc.send(chanKey, {
      op: 'rm',
      path: f.fullPath,
      isDir: !!f.isDir,
    });
  };

  React.useEffect(() => {
    const query = queryParse(global.location.search);
    const suuid = query['?uuid'] as string;
    const scnts = query['shellCnt'] as string;
    const scnt = parseInt(scnts);
    const schanKey = `SFTP_CHANNEL_${suuid}/${scnt}`;
    chanKey = schanKey;

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
        <Grid container spacing={1} alignItems="center" className="hoverGrey" >
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
          <Grid item xs={2}>
            <Typography variant="body2" sx={{ ml: 1 }}>
              {f.isDir ? '' : humanFileSize(f.size)}
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="body2" sx={{ ml: 1 }}>
              {f.mtime}
            </Typography>
          </Grid>
          <Grid item xs={3}>
            <Stack direction="row" spacing={0}>
              <IconButton size="small" title={t('Download')} onClick={() => getF(f)}>
                <DownloadIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" title={t('Rename')} onClick={() => renameF(f)}>
                <DriveFileRenameOutlineIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" title={t('Delete')} color="error" onClick={() => rmF(f)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>
      </ListItem>
    );
  });

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <CssBaseline />
      <SftpCurPath path={curDir} setPath={(p) => { updateCurDir(p) }} />
      <Stack direction="row" spacing={1} sx={{ m: 1 }}>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => { putF() }}>
          {t('Upload')}
        </Button>
        <Button variant="outlined" startIcon={<CreateNewFolderIcon />} onClick={() => { mkdirF() }}>
          {t('New Folder')}
        </Button>
      </Stack>
      {opError ? <Alert severity="error" sx={{ mx: 1 }}>{opError}</Alert> : null}
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
