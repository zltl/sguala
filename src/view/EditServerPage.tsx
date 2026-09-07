import * as React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import { useState } from 'react';
import { InputAdornment, Stack } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { Observer } from './Observer';
import { normalizeHostPort } from './parseConnection';

interface Props {
  goBack: () => void

  uuid?: string
  name?: string
  host?: string
  port?: number
  username?: string
  password?: string
  usePassword?: boolean
  privateKey?: string
  updateTime?: string
  groupUuid?: string

  useHop?: boolean
  hopServerUuid?: string
}

interface SshKeyItem {
  name: string;
  path: string;
}

export function EditServerPage(props: Props) {
  const { t } = useTranslation();
  const [groupUuid, setGroupUuid] = React.useState<string>(props.groupUuid || '');
  const uuid = props.uuid;
  const [name, setName] = useState(props.name || '');
  const [host, setHost] = useState(props.host || '');
  const [port, setPort] = useState(props.port ? props.port : 22);
  const [username, setUsername] = useState(props.username ? props.username : 'root');
  const [password, setPassword] = useState(props.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [usePassword, setUsePassword] = useState(!!props.usePassword);
  const [privateKey, setPrivateKey] = useState(props.privateKey || '');
  const [keyLabel, setKeyLabel] = useState(props.privateKey ? t('Loaded key') : '');
  const [useHop, setUseHop] = useState(!!props.useHop);
  const [hopServerUuid, setHopServerUuid] = useState(props.hopServerUuid || '');

  const [groupList, setGroupList] = useState<any[]>([]);
  const [serverList, setServerList] = useState<any[]>([]);
  const [sshKeys, setSshKeys] = useState<SshKeyItem[]>([]);
  const [selectedKeyPath, setSelectedKeyPath] = useState('');

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [res, setRes] = useState<any>(undefined);

  const getConfigs = async () => {
    const c = await main.conf.get();
    const g = c.groups || [];
    setGroupList(g);

    const ss: any[] = [];
    for (const grp of g) {
      for (const s of grp.servers || []) {
        ss.push(s);
      }
    }
    setServerList(ss);
    return g;
  };

  React.useEffect(() => {
    (async () => {
      const g = await getConfigs();
      if (!props.groupUuid) {
        const def = g.find((x: any) => x.name === 'Default') || g[0];
        if (def) {
          setGroupUuid(def.uuid);
        }
      }

      const keysRes = await main.conf.listSshKeys();
      if (keysRes?.type === 'ok' && Array.isArray(keysRes.keys)) {
        setSshKeys(keysRes.keys);
      }
    })();
  }, []);

  const goBack = () => {
    props.goBack && props.goBack();
  };

  const handleGroupChange = (event: SelectChangeEvent) => {
    const v = event.target.value;
    if (v === 'new-group') {
      setCreatingGroup(true);
      return;
    }
    setCreatingGroup(false);
    setGroupUuid(v);
  };

  const createGroupInline = async () => {
    const gname = newGroupName.trim();
    if (!gname) {
      setRes({ type: 'error', message: t('Group Name') });
      return;
    }
    const dup = await main.conf.validateGroupDuplicated(gname);
    if (dup) {
      setRes({ type: 'error', message: t('Group name already exists') });
      return;
    }
    const g = await main.conf.addGroup(gname);
    await getConfigs();
    setGroupUuid(g.uuid);
    setCreatingGroup(false);
    setNewGroupName('');
    setRes(undefined);
  };

  const applyKeyResult = (read: any) => {
    if (!read || read.type === 'cancel') {
      return;
    }
    if (read.type === 'error') {
      setRes({ type: 'error', message: read.message || t('Failed to read key') });
      return;
    }
    setPrivateKey(read.content || '');
    setKeyLabel(read.name || t('Loaded key'));
    setRes(undefined);
  };

  const pickKeyFile = async () => {
    const read = await main.conf.readSshKey();
    applyKeyResult(read);
    if (read?.type === 'ok') {
      setSelectedKeyPath('');
    }
  };

  const onKeySelect = async (event: SelectChangeEvent) => {
    const v = event.target.value;
    if (v === '__pick__') {
      await pickKeyFile();
      return;
    }
    if (v === '__paste__' || v === '__none__') {
      setSelectedKeyPath('');
      return;
    }
    setSelectedKeyPath(v);
    const read = await main.conf.readSshKey(v);
    applyKeyResult(read);
  };

  const confirm = async () => {
    if (!groupUuid) {
      setRes({ type: 'error', message: t('Select Group') });
      return;
    }
    if (!host || !name) {
      setRes({ type: 'error', message: t('Name and host are required') });
      return;
    }

    const normalized = normalizeHostPort(host, port);
    if (!normalized) {
      setRes({ type: 'error', message: t('Name and host are required') });
      return;
    }
    if (normalized.host !== host || normalized.port !== port) {
      setHost(normalized.host);
      setPort(normalized.port);
    }

    const ns = {
      groupUuid: groupUuid,
      uuid: uuid,
      name: name,
      host: normalized.host,
      port: normalized.port,
      username: username,
      password: password,
      usePassword: usePassword,
      privateKey: privateKey,
      updateTime: new Date().toISOString(),
      useHop: useHop,
      hopServerUuid: hopServerUuid
    };
    const result = await main.conf.addServer(ns);
    console.log("RES", JSON.stringify(result));

    if (result && result.type == 'error') {
      setRes(result);
      return;
    }

    Observer.notify('confChanged', {});
    goBack();
  };

  const groupSelectElems = groupList.map((g) => {
    return <MenuItem key={g.uuid} value={g.uuid}>{g.name}</MenuItem>
  });
  groupSelectElems.unshift(
    <MenuItem key='new-group' value='new-group'>
      <AddIcon fontSize="small" /> {t(' Create a New Group')}
    </MenuItem>
  );

  const serverSelectElems = serverList.map((s) => {
    return <MenuItem key={s.uuid} value={s.uuid}>{s.name}</MenuItem>
  });

  const keySelectValue = selectedKeyPath
    || (privateKey ? '__paste__' : '__none__');

  return (
    <Box>
      {res && res.type == 'error' &&
        <Alert severity="error" sx={{ m: 1 }}>{res.message}</Alert>
      }

      <Box sx={{
        '& > :not(style)': { m: 1 },
      }}>
        <TextField id="input-with-sx" label={t("Name")}
          sx={{ width: '100%' }}
          value={name}
          onChange={(e) => setName(e.target.value.trim())} />

        <FormControl fullWidth>
          <InputLabel id="demo-simple-select-label">{t('Select Group')}</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            value={creatingGroup ? 'new-group' : groupUuid}
            label={t('Select Group')}
            onChange={handleGroupChange}
          >
            {groupSelectElems}
          </Select>
        </FormControl>

        {creatingGroup && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label={t('Group Name')}
              fullWidth
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createGroupInline();
                }
              }}
            />
            <Button variant="contained" onClick={createGroupInline}>{t('Add')}</Button>
            <Button variant="outlined" onClick={() => {
              setCreatingGroup(false);
              setNewGroupName('');
            }}>{t('Cancel')}</Button>
          </Stack>
        )}

        <TextField id="input-with-sx" label={t("Domain Name/IP Address")}
          sx={{ width: '100%' }}
          value={host}
          onChange={(e) => setHost(e.target.value.trim())} />

        <TextField id="input-with-sx" label={t("Port")} type='number'
          sx={{ width: '20%' }}
          value={port}
          onChange={(e) => setPort(parseInt(e.target.value))} />

        <FormControlLabel
          sx={{ width: '100%' }}
          control={<Checkbox checked={useHop}
            onChange={(e) => setUseHop(e.target.checked)} />} label={t("Use hopping server")} />
        {useHop && <FormControl fullWidth>
          <InputLabel id="demo-simple-select-label">{t('Select Hopping Server')}</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            value={hopServerUuid}
            label={t('Select Hopping Server')}
            onChange={(e: SelectChangeEvent) => setHopServerUuid(e.target.value as string)}
          >
            {serverSelectElems}
          </Select>
        </FormControl>}


        <TextField id="input-with-sx" label={t("User Name")}
          sx={{ width: '100%' }}
          value={username}
          onChange={(e) => setUsername(e.target.value.trim())} />

        <FormControlLabel control={<Checkbox checked={usePassword}
          onChange={(e) => setUsePassword(e.target.checked)} />} label={t("Use password instead of ssh-key")} />

        {usePassword && <TextField id="input-with-sx" label={t("Password")}
          type={showPassword ? "text" : "password"}
          sx={{ width: '100%' }}
          value={password}
          helperText={t("Password stored separately hint")}
          onChange={(e) => setPassword(e.target.value.trim())}
          InputProps={{
            endAdornment: (<InputAdornment position='end'>
              <IconButton
                aria-label="toggle password visibility"
                onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </InputAdornment>)
          }}
        />}
        {!usePassword && (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
              <FormControl fullWidth>
                <InputLabel id="ssh-key-select">{t('SSH private key')}</InputLabel>
                <Select
                  labelId="ssh-key-select"
                  value={keySelectValue}
                  label={t('SSH private key')}
                  onChange={onKeySelect}
                >
                  <MenuItem value="__none__">{t('None (edit later)')}</MenuItem>
                  {privateKey && !selectedKeyPath && (
                    <MenuItem value="__paste__">
                      {keyLabel || t('Loaded key')}
                    </MenuItem>
                  )}
                  {sshKeys.map((k) => (
                    <MenuItem key={k.path} value={k.path}>{k.name}</MenuItem>
                  ))}
                  <MenuItem value="__pick__">{t('Choose key file…')}</MenuItem>
                </Select>
              </FormControl>
              <IconButton onClick={pickKeyFile} title={t('Choose key file…')}>
                <FolderOpenIcon />
              </IconButton>
            </Stack>
            <TextField
              label={t("Ssh private key pem")}
              sx={{ width: '100%' }}
              multiline
              maxRows={5}
              minRows={2}
              value={privateKey}
              placeholder={t('Paste PEM or choose a key file')}
              onChange={(e) => {
                setPrivateKey(e.target.value);
                setSelectedKeyPath('');
                setKeyLabel(e.target.value ? t('Pasted key') : '');
              }}
            />
          </>
        )}

        <Box mt={2}>
          <Button variant="contained" onClick={confirm}>{t("Confirm")}</Button>
          <Button sx={{ marginLeft: 2 }} variant="outlined"
            onClick={goBack}>{t("Cancel")}</Button>
        </Box>
      </Box >
    </Box >
  );
}
