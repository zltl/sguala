import * as React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import ComputerIcon from '@mui/icons-material/Computer';
import { Observer } from './Observer';
import { EditServerPage } from './EditServerPage';
import { parseConnections } from './parseConnection';

interface Props {
  goBack: () => void;
}

interface SshKeyItem {
  name: string;
  path: string;
}

export function QuickAddPage(props: Props) {
  const { t } = useTranslation();
  const [text, setText] = React.useState('');
  const [groupUuid, setGroupUuid] = React.useState('');
  const [groupList, setGroupList] = React.useState<any[]>([]);
  const [sshKeys, setSshKeys] = React.useState<SshKeyItem[]>([]);
  const [selectedKeyPath, setSelectedKeyPath] = React.useState('');
  const [privateKey, setPrivateKey] = React.useState('');
  const [keyLabel, setKeyLabel] = React.useState('');
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = async () => {
    const c = await main.conf.get();
    setGroupList(c.groups || []);
    const def = (c.groups || []).find((g: any) => g.name === 'Default') || c.groups?.[0];
    if (def) {
      setGroupUuid(def.uuid);
    }

    const keysRes = await main.conf.listSshKeys();
    if (keysRes?.type === 'ok' && Array.isArray(keysRes.keys)) {
      setSshKeys(keysRes.keys);
      if (keysRes.keys.length > 0) {
        const preferred =
          keysRes.keys.find((k: SshKeyItem) => k.name === 'id_ed25519') ||
          keysRes.keys.find((k: SshKeyItem) => k.name === 'id_rsa') ||
          keysRes.keys[0];
        setSelectedKeyPath(preferred.path);
        const read = await main.conf.readSshKey(preferred.path);
        if (read?.type === 'ok') {
          setPrivateKey(read.content);
          setKeyLabel(read.name || preferred.name);
        }
      }
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const goBack = () => {
    props.goBack && props.goBack();
  };

  const applyKeyResult = (read: any) => {
    if (!read || read.type === 'cancel') {
      return;
    }
    if (read.type === 'error') {
      setError(read.message || t('Failed to read key'));
      return;
    }
    setPrivateKey(read.content || '');
    setKeyLabel(read.name || '');
    setError('');
  };

  const onKeySelect = async (event: SelectChangeEvent) => {
    const v = event.target.value;
    if (v === '__pick__') {
      const read = await main.conf.readSshKey();
      applyKeyResult(read);
      if (read?.type === 'ok') {
        setSelectedKeyPath('');
      }
      return;
    }
    if (v === '__none__') {
      setSelectedKeyPath('');
      setPrivateKey('');
      setKeyLabel('');
      return;
    }
    setSelectedKeyPath(v);
    const read = await main.conf.readSshKey(v);
    applyKeyResult(read);
  };

  const openFullForm = () => {
    const { ok, errors } = parseConnections(text);
    if (errors.length > 0) {
      setError(t('Invalid connection lines') + ': ' + errors.join(', '));
      return;
    }
    if (ok.length === 0) {
      setError(t('Paste at least one connection'));
      return;
    }
    const first = ok[0];
    Observer.notify('shellNavigateTo', {
      name: t('Add Server'),
      page: (
        <EditServerPage
          goBack={goBack}
          name={first.name}
          host={first.host}
          port={first.port}
          username={first.username}
          groupUuid={groupUuid}
          privateKey={privateKey}
          usePassword={false}
        />
      ),
      icon: <ComputerIcon />,
    });
  };

  const confirm = async () => {
    setError('');
    setInfo('');
    const { ok, errors } = parseConnections(text);
    if (errors.length > 0) {
      setError(t('Invalid connection lines') + ': ' + errors.join(', '));
      return;
    }
    if (ok.length === 0) {
      setError(t('Paste at least one connection'));
      return;
    }
    if (!groupUuid) {
      setError(t('Select Group'));
      return;
    }

    setBusy(true);
    let added = 0;
    try {
      for (const item of ok) {
        const res = await main.conf.addServer({
          groupUuid,
          name: item.name,
          host: item.host,
          port: item.port,
          username: item.username,
          usePassword: false,
          privateKey: privateKey || undefined,
          updateTime: new Date().toISOString(),
        });
        if (res?.type === 'error') {
          setError(res.message || t('Add server failed'));
          setBusy(false);
          return;
        }
        added += 1;
      }
      Observer.notify('confChanged', {});
      setInfo(t('Added n servers', { count: added }));
      setTimeout(() => goBack(), 400);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ '& > :not(style)': { m: 1 } }}>
      {error && <Alert severity="error">{error}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('Quick add hint')}
      </Typography>

      <TextField
        label={t('Connection strings')}
        placeholder={'root@10.0.0.1\ndeploy@example.com:2222'}
        multiline
        minRows={4}
        maxRows={12}
        fullWidth
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <FormControl fullWidth>
        <InputLabel id="quick-add-group">{t('Select Group')}</InputLabel>
        <Select
          labelId="quick-add-group"
          value={groupUuid}
          label={t('Select Group')}
          onChange={(e: SelectChangeEvent) => setGroupUuid(e.target.value)}
        >
          {groupList.map((g) => (
            <MenuItem key={g.uuid} value={g.uuid}>{g.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel id="quick-add-key">{t('SSH private key')}</InputLabel>
        <Select
          labelId="quick-add-key"
          value={selectedKeyPath || (keyLabel ? '__picked__' : '__none__')}
          label={t('SSH private key')}
          onChange={onKeySelect}
        >
          <MenuItem value="__none__">{t('None (edit later)')}</MenuItem>
          {keyLabel && !selectedKeyPath && (
            <MenuItem value="__picked__">{keyLabel}</MenuItem>
          )}
          {sshKeys.map((k) => (
            <MenuItem key={k.path} value={k.path}>{k.name}</MenuItem>
          ))}
          <MenuItem value="__pick__">{t('Choose key file…')}</MenuItem>
        </Select>
      </FormControl>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button variant="contained" disabled={busy} onClick={confirm}>
          {t('Add')}
        </Button>
        <Button variant="outlined" disabled={busy} onClick={openFullForm}>
          {t('Open full form')}
        </Button>
        <Button variant="outlined" disabled={busy} onClick={goBack}>
          {t('Cancel')}
        </Button>
      </Stack>
    </Box>
  );
}
