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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import MailIcon from '@mui/icons-material/Mail';
import { useTranslation } from 'react-i18next';

import './ShellPage.css';

const drawerWidth = 240;

interface Props {
  pages: { name: string, page: React.ReactNode, icon: React.ReactNode }[];
  curPageName: string;
}

export function ShellDrawer(props: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  return (
    <List>
      {
        props.pages.map((page, index) => (
          <ListItem key={page.name} disablePadding>
            <ListItemButton selected={page.name === props.curPageName}>
              <ListItemIcon>
                {page.icon}
              </ListItemIcon>
              <ListItemText primary={t(page.name)} />
            </ListItemButton>
          </ListItem>
        ))
      }
    </List>
  );
}

/*
    <DrawerHeader
      className='DragableRegion'>
      <IconButton onClick={handleDrawerClose}
        className="DragableRegionExcept">
        {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
    </DrawerHeader>

*/