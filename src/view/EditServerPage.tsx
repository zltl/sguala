import * as React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import GroupIcon from '@mui/icons-material/Storage';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import { Observer } from './Observer';
import { useState } from 'react';
import { InputAdornment } from '@mui/material';
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
import { AddGroupPage } from './AddGroupPage';
import Computer from '@mui/icons-material/Computer';


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

export function EditServerPage(props: Props) {
  const { t, i18n } = useTranslation();
  const [groupUuid, setGroupUuid] = React.useState<string>(props.groupUuid);
  const updateTime = props.updateTime;

  const uuid = props.uuid;
  const [name, setName] = useState(props.name);
  const [host, setHost] = useState(props.host);
  const [port, setPort] = useState(props.port ? props.port : 22);
  const [username, setUsername] = useState(props.username ? props.username : 'root');
  const [password, setPassword] = useState(props.password);
  const [showPassword, setShowPassword] = useState(false);
  const [usePassword, setUsePassword] = useState(props.usePassword);
  const [privateKey, setPrivateKey] = useState(props.privateKey);
  const [useHop, setUseHop] = useState(props.useHop);
  const [hopServerUuid, setHopServerUuid] = useState(props.hopServerUuid);

  const [groupList, setGroupList] = useState<any[]>([]);
  const [serverList, setServerList] = useState<any[]>([]);

  const [res, setRes] = useState<any>(undefined);

  const handleGroupChange = (event: SelectChangeEvent) => {
    const v = event.target.value;
    if (v == 'new-group') {
      Observer.notify('shellNavigateTo', {
        name: 'Add Group',
        page: <AddGroupPage
          goBack={() => {
            Observer.notify('shellNavigateTo', {
              name: uuid ? t('Edit Server') : t('Add Server'),
              page: <EditServerPage
                uuid={uuid}
                name={name}
                host={host}
                port={port}
                username={username}
                password={password}
                usePassword={usePassword}
                privateKey={privateKey}
                updateTime={updateTime}
                useHop={useHop}
                hopServerUuid={hopServerUuid}
                goBack={props.goBack}
              />,
              icon: <Computer />,
            })
          }} />,
        icon: <GroupIcon />,
      });
    }
    else {
      setGroupUuid(v);
    }
  };

  const getConfigs = async () => {
    const c = await main.conf.get();
    const g = c.groups;
    setGroupList(g);

    const ss: any[] = [];
    for (const g of c.groups) {
      for (const s of g.servers) {
        ss.push(s);
      }
    }
    setServerList(ss);
  };

  React.useEffect(() => {
    getConfigs();
  });

  const goBack = () => {
    props.goBack && props.goBack();
  };

  const confirm = async () => {
    const ns = {
      groupUuid: groupUuid,
      uuid: uuid,
      name: name,
      host: host,
      port: port,
      username: username,
      password: password,
      usePassword: usePassword,
      privateKey: privateKey,
      updateTime: new Date().toISOString(),
      useHop: useHop,
      hopServerUuid: hopServerUuid
    };
    const res = await main.conf.addServer(ns);
    console.log("RES", JSON.stringify(res));

    if (res && res.type == 'error') {
      setRes(res);
    }

    goBack();
  };

  const groupSelectElems = groupList.map((g) => {
    return <MenuItem key={g.uuid} value={g.uuid}>{g.name}</MenuItem>
  });
  groupSelectElems.unshift(<MenuItem key='new-group' value='new-group'><AddIcon /> {t(' Create a New Group')}</MenuItem>);

  const serverSelectElems = serverList.map((s) => {
    return <MenuItem key={s.uuid} value={s.uuid}>{s.name}</MenuItem>
  });

  return (
    <Box>
      {res && res.type == 'error' &&
        <Alert severity="error">{res.message}</Alert>
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
            value={groupUuid}
            label={t('Select Group')}
            onChange={handleGroupChange}
          >
            {groupSelectElems}
          </Select>
        </FormControl>

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
          control={<Checkbox value={useHop}
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

        <FormControlLabel control={<Checkbox value={usePassword}
          onChange={(e) => setUsePassword(e.target.checked)} />} label={t("Use password instead of ssh-key")} />

        {usePassword && <TextField id="input-with-sx" label={t("Password")}
          type={showPassword ? "text" : "password"}
          sx={{ width: '100%' }}
          value={password}
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
        {!usePassword &&
          <TextField id="input-with-sx" label={t("Ssh private key pem")} type='number'
            sx={{ width: '100%' }}
            multiline
            maxRows={5}
            minRows={2}
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)} />
        }

        <Box mt={2}>
          <Button variant="contained" onClick={confirm}>{t("Confirm")}</Button>
          <Button sx={{ marginLeft: 2 }} variant="outlined"
            onClick={goBack}>{t("Cancel")}</Button>
        </Box>
      </Box >
    </Box >
  );
}
