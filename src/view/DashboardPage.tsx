import * as React from 'react';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Stack from '@mui/material/Stack';
import GroupIcon from '@mui/icons-material/Storage';
import ComputerIcon from '@mui/icons-material/Computer';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ClickAwayListener from '@mui/base/ClickAwayListener';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
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


export function DashboardPage() {
  const { t } = useTranslation();
  const [showAllButtons, setShowAllButtons] = React.useState(false);
  const [conf, setConf] = React.useState(undefined);
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

  const serverGroups = conf?.groups?.map((group: any) => {
    if (group.name == 'Default' && (!group.servers || group.servers.length === 0)) {
      return null;
    }
    return (
      <ServerGroup group={group} key={JSON.stringify(group)} reloadConf={() => { reloadConf() }} />
    );
  });

  serverGroups && serverGroups.push(<ServerGroupEnd key="group_end_a" reloadConf={() => reloadConf()} />);

  return (
    <>
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
