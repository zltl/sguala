import * as React from 'react';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Stack from '@mui/material/Stack';
import GroupIcon from '@mui/icons-material/Storage';
import ComputerIcon from '@mui/icons-material/Computer';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ClickAwayListener from '@mui/base/ClickAwayListener';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { AddGroupPage } from './AddGroupPage';
import { Observer } from './Observer';
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { EditServerPage } from './EditServerPage';
import { QuickAddPage } from './QuickAddPage';

import './ShellPage.css';
import { LabelFab } from './LabelFab';
import { ServerGroup, ServerGroupEnd } from './ServerGroup';

function serverMatches(server: any, groupName: string, q: string): boolean {
  if (!q) {
    return true;
  }
  const hay = [
    server?.name,
    server?.host,
    server?.username,
    groupName,
    server?.port != null ? String(server.port) : '',
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

export function DashboardPage() {
  const { t } = useTranslation();
  const [showAllButtons, setShowAllButtons] = React.useState(false);
  const [conf, setConf] = React.useState(undefined);
  const [query, setQuery] = React.useState('');
  const [toast, setToast] = React.useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const goHome = () => { Observer.notify('changePage', 'sguala') };

  const addGroupPage = {
    name: t('Add Group'),
    page: <AddGroupPage goBack={goHome} />,
    icon: <GroupIcon />,
  };

  const addServerPage = {
    name: t('Add Server'),
    page: <EditServerPage goBack={goHome} />,
    icon: <ComputerIcon />,
  };

  const quickAddPage = {
    name: t('Quick Add'),
    page: <QuickAddPage goBack={goHome} />,
    icon: <FlashOnIcon />,
  };

  const reloadConf = async () => {
    const c = await main.conf.get();
    setConf(c);
  };

  React.useEffect(() => {
    reloadConf();
    const cancel = Observer.on('confChanged', () => {
      reloadConf();
    });
    return () => { cancel(); };
  }, []);

  const importSettings = async () => {
    setShowAllButtons(false);
    const res = await main.conf.importSettings();
    if (!res || res.type === 'cancel') {
      return;
    }
    if (res.type === 'error') {
      setToast({ severity: 'error', message: res.message || t('Import failed') });
      return;
    }
    await reloadConf();
    Observer.notify('confChanged', {});
    setToast({ severity: 'success', message: t('Import succeeded') });
  };

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const visibleGroups = (conf?.groups || []).map((group: any) => {
    const groupNameMatch = searching && (group.name || '').toLowerCase().includes(q);
    const servers = (group.servers || []).filter((s: any) =>
      groupNameMatch || serverMatches(s, group.name, q)
    );
    return { ...group, servers };
  }).filter((group: any) => {
    if (group.name == 'Default' && (!group.servers || group.servers.length === 0)) {
      return false;
    }
    if (!searching) {
      return true;
    }
    return (group.servers || []).length > 0 || (group.name || '').toLowerCase().includes(q);
  });

  const matchCount = visibleGroups.reduce(
    (n: number, g: any) => n + (g.servers?.length || 0),
    0
  );

  const serverGroups = visibleGroups.map((group: any) => (
    <ServerGroup
      group={group}
      key={group.uuid + (searching ? ':s' : '')}
      reloadConf={() => { reloadConf() }}
      forceExpand={searching}
    />
  ));

  serverGroups.push(<ServerGroupEnd key="group_end_a" reloadConf={() => reloadConf()} />);

  return (
    <>
      <Box sx={{ px: 1, pt: 1, pb: 0.5, position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper' }}>
        <TextField
          size="small"
          fullWidth
          value={query}
          placeholder={t('Search hosts')}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label={t('Clear search')} onClick={() => setQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
        {searching && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 0.5 }}>
            {t('Search result count', { count: matchCount })}
          </Typography>
        )}
      </Box>

      <DndProvider backend={HTML5Backend}>
        {serverGroups}
      </DndProvider>
      <ClickAwayListener onClickAway={() => {
        setShowAllButtons(false);
      }}>
        <Stack
          direction="column"
          spacing={2}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
          }}>
          {showAllButtons && <>
            <LabelFab
              label={t('Quick Add')}
              icon={<FlashOnIcon />}
              color='secondary'
              onClick={() => {
                setShowAllButtons(false);
                Observer.notify('shellNavigateTo', quickAddPage);
              }}
            />

            <LabelFab
              label={t('Add Server')}
              icon={<ComputerIcon />}
              color='secondary'
              onClick={() => {
                setShowAllButtons(false);
                Observer.notify('shellNavigateTo', addServerPage);
              }}
            />

            <LabelFab
              label={t('Add Group')}
              icon={<GroupIcon />}
              color='primary'
              onClick={() => {
                setShowAllButtons(false);
                Observer.notify('shellNavigateTo', addGroupPage);
              }}
            />

            <LabelFab
              label={t('Import Settings')}
              icon={<UploadFileIcon />}
              color='primary'
              onClick={() => { importSettings(); }}
            />
          </>}

          {!showAllButtons && <Fab
            color='primary'
            onClick={() => {
              setShowAllButtons(true);
            }}
          >
            <AddIcon />
          </Fab>}
        </Stack>
      </ClickAwayListener>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity || 'success'}
          onClose={() => setToast(null)}
          sx={{ width: '100%' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
