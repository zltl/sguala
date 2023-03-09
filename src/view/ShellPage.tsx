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

import './ShellPage.css';
import { DashboardPage } from './DashboardPage';
import { ShellDrawer } from './ShellDrawer';
import { DrawerHeader } from './DrawerHeader';
import InsightsIcon from '@mui/icons-material/Insights';
import { AddGroupPage } from './AddGroupPage';
import { Observer } from './Observer';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

export function ShellPage() {
  const { t, i18n } = useTranslation();

  // page: name, page, icon
  const pages = [
    { name: 'sguala', page: <DashboardPage />, icon: <InsightsIcon /> },
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

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const theme = useTheme();
  const background = theme.palette.background.default;

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}
        className='DragableRegion'>
        <Toolbar variant="dense">
          <IconButton
            className="DragableRegionExcept"
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{ mr: 2, ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" >
            {t(curPage.name)}
          </Typography>
        </Toolbar>
      </AppBar>
      <ShellDrawer
        handleDrawerClose={handleDrawerClose}
        open={open}
        pages={pages}
        curPageName={curPage.name} />
      <Main open={open} sx={{
        backgroundColor: background,
      }}>
        <DrawerHeader />
        {curPage.page}
      </Main>
    </Box>
  );
}