import * as React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import GroupIcon from '@mui/icons-material/Storage';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import { Observer } from './Observer';

interface Props {
  prevPageName: string;
}

export function AddGroupPage(props: Props) {
  const { t, i18n } = useTranslation();
  const [groupName, setGroupName] = React.useState<string>(null);

  const goBack = () => {
    Observer.notify('changePage', props.prevPageName);
  };

  const confirm = async () => {
    const g = await main.conf.addGroup(groupName);
    console.log("New group: ", JSON.stringify(g));
    goBack();
  };

  return (
    <Box component="form">
      <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
        <GroupIcon sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
        <TextField id="input-with-sx" label={t("Group Name")} variant="standard" sx={{ width: '100%' }}
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)} />
      </Box>
      <Box mt={2}>
        <Button variant="contained" onClick={confirm}>{t("Confirm")}</Button>
        <Button sx={{ marginLeft: 2 }} variant="outlined"
          onClick={goBack}>{t("Cancel")}</Button>
      </Box>
    </Box>
  );
}
