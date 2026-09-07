import React from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';

import { useTranslation } from 'react-i18next';
import { Alert, Button, Divider, FormControlLabel, Checkbox, Stack, Typography } from '@mui/material';
import { Observer } from './Observer';

export function SettingPage() {
  const { t } = useTranslation();
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [includeKeys, setIncludeKeys] = React.useState(false);
  const [includeSecrets, setIncludeSecrets] = React.useState(false);
  const [overwrite, setOverwrite] = React.useState(false);

  const sgualaRepo = "https://github.com/zltl/sguala";
  const gpl3Url = "https://www.gnu.org/licenses/gpl-3.0.en.html";

  const exportSettings = async () => {
    main.conf.exportSettings();
  };

  const importSettings = async () => {
    const res = await main.conf.importSettings();
    if (!res || res.type === 'cancel') {
      return;
    }
    if (res.type === 'error') {
      setMsg({ type: 'error', text: res.message || t('Import failed') });
      return;
    }
    Observer.notify('confChanged', {});
    setMsg({ type: 'success', text: t('Import succeeded') });
  };

  const exportBundle = async () => {
    const res = await main.conf.exportBundle({ includeKeys, includeSecrets });
    if (!res || res.type === 'cancel') return;
    if (res.type === 'error') {
      setMsg({ type: 'error', text: res.message || t('Export failed') });
      return;
    }
    setMsg({
      type: 'success',
      text: t('Bundle export ok', { path: res.path || '' }) + (res.message ? ` (${res.message})` : ''),
    });
  };

  const importBundle = async () => {
    const res = await main.conf.importBundle({
      overwrite,
      includeKeys: true,
      includeSecrets: true,
    });
    if (!res || res.type === 'cancel') return;
    if (res.type === 'error') {
      setMsg({ type: 'error', text: res.message || t('Import failed') });
      return;
    }
    Observer.notify('confChanged', {});
    setMsg({
      type: 'success',
      text: res.message || t('Import succeeded'),
    });
  };

  return (
    <Box>
      <Link href={sgualaRepo}
        onClick={(e) => {
          e.preventDefault();
          main.shell.openExternal(sgualaRepo);
        }}>sguala</Link> is
      a free and open source software licensed under the <Link href={gpl3Url}
        onClick={(e) => {
          e.preventDefault();
          main.shell.openExternal(gpl3Url);
        }}>
        GNU General Public License v3.0
      </Link>.
      <Divider sx={{ my: 1 }} />

      {msg && (
        <Alert severity={msg.type} sx={{ mt: 1 }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <Typography variant="subtitle1" sx={{ mt: 2 }}>{t('Export / Import Bundle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('Bundle hint')}
      </Typography>
      <Stack spacing={0}>
        <FormControlLabel
          control={<Checkbox checked={includeKeys} onChange={(e) => setIncludeKeys(e.target.checked)} />}
          label={t('Include private keys')}
        />
        <FormControlLabel
          control={<Checkbox checked={includeSecrets} onChange={(e) => setIncludeSecrets(e.target.checked)} />}
          label={t('Include passwords')}
        />
        <FormControlLabel
          control={<Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />}
          label={t('Overwrite existing hosts on import')}
        />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button onClick={() => exportBundle()} variant="contained">
          {t('Export Bundle')}
        </Button>
        <Button onClick={() => importBundle()} variant="contained">
          {t('Import Bundle')}
        </Button>
      </Stack>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" color="text.secondary">{t('Legacy JSON')}</Typography>
      <div style={{ marginTop: '2px' }}>
        <Button onClick={() => exportSettings()} variant="outlined">
          {t('Export Settings')}
        </Button>
      </div>
      <div style={{ marginTop: '2px' }}>
        <Button onClick={() => importSettings()} variant="outlined">
          {t('Import Settings')}
        </Button>
      </div>
    </Box>
  );
}
