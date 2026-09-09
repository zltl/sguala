import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import CssBaseline from '@mui/material/CssBaseline';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import { useTranslation } from 'react-i18next';
import GroupIcon from '@mui/icons-material/Storage';
import ClickAwayListener from '@mui/base/ClickAwayListener';
import './ShellPage.css';
import { DashboardPage } from './DashboardPage';
import { ShellDrawer } from './ShellDrawer';
import InsightsIcon from '@mui/icons-material/Insights';
import { AddGroupPage } from './AddGroupPage';
import { Observer } from './Observer';
import { Stack } from '@mui/material';
import { SettingPage } from './SettingPage';
import SettingsIcon from '@mui/icons-material/Settings';


const drawerWidth = 240;
const appBarHeight = '2.1em';
const mainMargin = '1em';
const mainWidth = `calc(100% - ${mainMargin} - ${mainMargin})`;
const mainWidthOpen = `calc(100% - ${drawerWidth}px - ${mainMargin} - ${mainMargin})`;
const mainHeight = `calc(100% - ${appBarHeight} - ${mainMargin} - ${mainMargin})`;

export function ShellPage() {
  const { t, i18n } = useTranslation();

  // page: name, page, icon
  const pages = [
    { name: 'sguala', page: <DashboardPage />, icon: <InsightsIcon /> },
    { name: 'setting', page: <SettingPage />, icon: <SettingsIcon /> },
  ];

  const [open, setOpen] = React.useState(false);
  const [curPage, setCurPage] = React.useState(pages[0]);

  React.useEffect(() => {
    const cancelfn = Observer.on('shellNavigateTo', (e: string, page: { name: string, page: JSX.Element, icon: JSX.Element }) => {
      setCurPage(page);
    });
    const cancelfn2 = Observer.on('changePage', (e: string, pageName: string) => {
      const page = pages.find((p) => p.name === pageName);
      if (page) {
        setCurPage(page);
      }
    });

    return () => {
      cancelfn();
      cancelfn2();
    };
  }, []);


  const theme = useTheme();

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <CssBaseline />
      <div className='DragableRegion' style={{
        position: 'fixed',
        top: 0, left: 0,
        height: appBarHeight, width: '100%',
        backgroundColor: theme.palette.primary.main,
        paddingLeft: '0.5em'
      }}>
        <IconButton className="DragableRegionExcept" sx={{ color: theme.palette.background.default }}
          onClick={() => setOpen(!open)}>
          <MenuIcon />
        </IconButton>
        <Box display='inline-flex' sx={{ marginLeft: 1 }}>
          <Typography sx={{ color: theme.palette.background.default }}>
            {t(curPage.name)}
          </Typography>
        </Box>
      </div>


      {open && <ClickAwayListener onClickAway={() => setOpen(false)}>
        <div style={{
          position: 'fixed',
          top: appBarHeight,
          left: 0,
          width: drawerWidth,
          height: `calc(100% - ${appBarHeight})`,
          borderRight: '1px solid #ccc',
          backgroundColor: theme.palette.background.default,
        }}>
          <div >
            <ShellDrawer
              pages={pages}
              curPageName={curPage.name}
            />
          </div>
        </div>
      </ClickAwayListener>}

      <div style={{
        position: 'fixed',
        overflow: 'auto',
        top: appBarHeight,
        left: open ? drawerWidth : 0,
        width: open ? mainWidthOpen : mainWidth,
        height: mainHeight,
        margin: mainMargin,
      }}
        className="hidescrollbar">
        {curPage.page}
      </div>
    </div>
  );
}
