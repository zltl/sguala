import React from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';

import { useTranslation } from 'react-i18next';
import { Alert, Button, Divider } from '@mui/material';
import { Observer } from './Observer';

export function SettingPage() {
  const { t } = useTranslation();
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  }

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
      <Divider />

      {msg && (
        <Alert severity={msg.type} sx={{ mt: 1 }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div style={{marginTop: '2px'}}>
      <Button onClick={() => exportSettings()} variant="contained">
        {t('Export Settings')}
      </Button>
      </div>

      <div style={{marginTop: '2px'}}>
      <Button onClick={() => importSettings()} variant="contained">
        {t('Import Settings')}
      </Button>
      </div>
    </Box>
  );
}
