import * as React from 'react';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Stack from '@mui/material/Stack';
import GroupIcon from '@mui/icons-material/Storage';
import ComputerIcon from '@mui/icons-material/Computer';
import ClickAwayListener from '@mui/base/ClickAwayListener';
import { AddGroupPage } from './AddGroupPage';
import { Observer } from './Observer';
import { DndProvider, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import './ShellPage.css';
import { LabelFab } from './LabelFab';
import { ServerGroup, ServerGroupEnd } from './ServerGroup';


export function DashboardPage() {
  const [showAllButtons, setShowAllButtons] = React.useState(false);
  const [conf, setConf] = React.useState(undefined);

  const addGroupPage = {
    name: 'Add Group',
    page: <AddGroupPage
      prevPageName='sguala' />,
    icon: <GroupIcon />,
  };

  const reloadConf = async () => {
    const c = await main.conf.get();
    setConf(c);
  };

  React.useEffect(() => {
    reloadConf();
  }, []);

  const serverGroups = conf?.groups?.map((group: any) => {
    if (group.name == 'Default' && (!group.servers || group.servers.length === 0)) {
      return null;
    }
    return (
      <ServerGroup group={group} key={group.uuid} reloadConf={() => { reloadConf() }} />
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
              label='添加服务器'
              icon={<ComputerIcon />}
              color='secondary'
              onClick={() => { console.log("add server") }}
            />

            <LabelFab
              label='添加组'
              icon={<GroupIcon />}
              color='primary'
              onClick={() => { Observer.notify('shellNavigateTo', addGroupPage) }}
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
    </>
  );
}
