import React from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';

import { useTranslation } from 'react-i18next';
import { Divider } from '@mui/material';
import Typography from '@mui/material/Typography';

export function SettingPage() {
  const { t, i18n } = useTranslation();

  const sgualaRepo = "https://github.com/zltl/sguala";
  const gpl3Url = "https://www.gnu.org/licenses/gpl-3.0.en.html";

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

      <Typography>
        没啥可设置的。
      </Typography>

    </Box>
  );
}
