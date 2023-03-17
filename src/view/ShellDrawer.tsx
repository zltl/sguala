import * as React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import MailIcon from '@mui/icons-material/Mail';
import { useTranslation } from 'react-i18next';
import { Observer } from './Observer';

import './ShellPage.css';

const drawerWidth = 240;

interface Props {
  pages: { name: string, page: React.ReactNode, icon: React.ReactNode }[];
  curPageName: string;
}

export function ShellDrawer(props: Props) {
  const { t, i18n } = useTranslation();

  const navigateTo = (name: string) => {
    Observer.notify('changePage', name)
  }

  return (
    <List>
      {
        props.pages.map((page, index) => (
          <ListItem key={page.name} disablePadding>
            <ListItemButton selected={page.name === props.curPageName}
              onClick={() => { navigateTo(page.name) }}>
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

