import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { Observer } from './Observer';

interface Props {
  goBack: () => void;
}

interface SshConfigHostRow {
  name: string;
  hostName: string;
  user: string;
  port: number;
  identityFile?: string;
  proxyJump?: string;
}

export function ImportSshConfigPage(props: Props) {
  const { t } = useTranslation();
  const [hosts, setHosts] = React.useState<SshConfigHostRow[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [groupUuid, setGroupUuid] = React.useState('');
  const [groupList, setGroupList] = React.useState<any[]>([]);
  const [configPath, setConfigPath] = React.useState('');
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const c = await main.conf.get();
      setGroupList(c.groups || []);
      const def = (c.groups || []).find((g: any) => g.name === 'Default') || c.groups?.[0];
      if (def) {
        setGroupUuid(def.uuid);
      }

      const res = await main.conf.listSshConfigHosts();
      if (res?.type === 'error') {
        setError(res.message || t('Failed to read SSH config'));
        setHosts([]);
        return;
      }
      const list: SshConfigHostRow[] = res?.hosts || [];
      setHosts(list);
      setConfigPath(res?.path || '~/.ssh/config');
      setSelected(new Set(list.map((h) => h.name)));
      if (list.length === 0) {
        setInfo(t('No concrete hosts in SSH config'));
      }
    } catch (e: any) {
      setError(e?.message || t('Failed to read SSH config'));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const goBack = () => {
    props.goBack && props.goBack();
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(hosts.map((h) => h.name)));
  const selectNone = () => setSelected(new Set());

  const confirm = async () => {
    setError('');
    setInfo('');
    if (selected.size === 0) {
      setError(t('Select at least one host'));
      return;
    }
    if (!groupUuid) {
      setError(t('Select Group'));
      return;
    }
    setBusy(true);
    try {
      const res = await main.conf.importSshConfigHosts({
        groupUuid,
        names: Array.from(selected),
      });
      if (res?.type === 'error') {
        setError(res.message || t('Import failed'));
        return;
      }
      Observer.notify('confChanged', {});
      setInfo(t('SSH config import result', {
        added: res.added ?? 0,
        skipped: res.skipped ?? 0,
      }));
      setTimeout(() => goBack(), 600);
    } finally {
      setBusy(false);
    }
  };

  const secondaryText = (h: SshConfigHostRow) => {
    const parts = [`${h.user}@${h.hostName}:${h.port}`];
    if (h.identityFile) {
      parts.push(h.identityFile);
    }
    if (h.proxyJump) {
      parts.push(`via ${h.proxyJump}`);
    }
    return parts.join(' · ');
  };

  return (
    <Box sx={{ '& > :not(style)': { m: 1 } }}>
      {error && <Alert severity="error">{error}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}

      <Typography variant="body2" color="text.secondary">
        {t('Import SSH config hint', { path: configPath || '~/.ssh/config' })}
      </Typography>

      <FormControl fullWidth>
        <InputLabel id="ssh-config-group">{t('Select Group')}</InputLabel>
        <Select
          labelId="ssh-config-group"
          value={groupUuid}
          label={t('Select Group')}
          onChange={(e: SelectChangeEvent) => setGroupUuid(e.target.value)}
        >
          {groupList.map((g) => (
            <MenuItem key={g.uuid} value={g.uuid}>{g.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={selectAll} disabled={loading || hosts.length === 0}>
          {t('Select all')}
        </Button>
        <Button size="small" onClick={selectNone} disabled={loading || hosts.length === 0}>
          {t('Select none')}
        </Button>
        <Button size="small" onClick={load} disabled={loading || busy}>
          {t('Reload')}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {t('Selected count', { count: selected.size, total: hosts.length })}
        </Typography>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <List dense sx={{ maxHeight: '55vh', overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {hosts.map((h) => (
            <ListItem key={h.name} disablePadding>
              <ListItemButton onClick={() => toggle(h.name)} dense>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={selected.has(h.name)}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText
                  primary={h.name}
                  secondary={secondaryText(h)}
                  primaryTypographyProps={{ fontFamily: 'monospace' }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button variant="contained" disabled={busy || loading || selected.size === 0} onClick={confirm}>
          {t('Import')}
        </Button>
        <Button variant="outlined" disabled={busy} onClick={goBack}>
          {t('Cancel')}
        </Button>
      </Stack>
    </Box>
  );
}
