import React from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';

import { useTranslation } from 'react-i18next';
import { Button, Divider } from '@mui/material';
import Typography from '@mui/material/Typography';

export function SettingPage() {
  const { t, i18n } = useTranslation();

  const sgualaRepo = "https://github.com/zltl/sguala";
  const gpl3Url = "https://www.gnu.org/licenses/gpl-3.0.en.html";


  const exportSettings = async () => {
    main.conf.exportSettings();
  };

  const importSettings = async () => {
    main.conf.importSettings();
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

      <Button onClick={() => exportSettings()} variant="contained">
        {t('Export Settings')}
      </Button>

      <Button onClick={() => importSettings()} variant="contained">
        {t('Import Settings')}
      </Button>

    </Box>
  );
}
