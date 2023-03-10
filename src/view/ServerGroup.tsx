import * as React from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ServerCard } from './ServerCard';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box } from '@mui/system';
import { useDrag, useDrop } from 'react-dnd'
import LinearProgress from '@mui/material/LinearProgress';
import { blue } from '@mui/material/colors';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClickAwayListener from '@mui/base/ClickAwayListener';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';

interface Props {
  group: { name: string, uuid: string, tabOpening?: boolean, servers: any[] };
  reloadConf: () => void;
}

export function ServerGroupEnd({ reloadConf }: { reloadConf: () => void }) {
  const [{ isOver }, drop] = useDrop({
    accept: 'group',
    drop: (item: any) => {
      console.log('drop item to end:', JSON.stringify(item));
      (async () => {
        await main.conf.moveGroup(item.uuid, 'end');
        reloadConf();
      })();
    },
    collect: monitor => ({
      isOver: !!monitor.isOver(),
    }),
  }, []);

  return (
    <Box ref={drop} sx={{ height: 200, width: '100%' }}>
      {isOver && <LinearProgress variant="determinate" color="secondary" value={0} />}
    </Box>
  );
}

export function ServerGroup(props: Props) {
  const [t, i18n] = useTranslation();
  const group = props.group;
  const [expanded, stSetExpanded] = React.useState(group.tabOpening ? true : false);

  const [mouseEnter, setMouseEnter] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [groupName, setGroupName] = React.useState(group.name);

  const setExpanded = async (open: boolean) => {
    stSetExpanded(open);
    group.tabOpening = open;
    await main.conf.openGroupTab(group.uuid, open);
  };

  const updateGroupName = async () => {
    setEditing(false);
    if (groupName === group.name) {
      return;
    }
    group.name = groupName;
    await main.conf.updateGroup(group.uuid, groupName);
  };

  const deleteGroup = async () => {
    await main.conf.removeGroup(group.uuid);
    props.reloadConf();
  };

  const [{ opacity, isDragging }, dragRef, dragPreviewRef] = useDrag(
    () => ({
      type: 'group',
      item: { uuid: group.uuid },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.3 : 1,
        isDragging: monitor.isDragging(),
      })
    }),
    [props.group]
  );

  const [{ isOver }, drop] = useDrop({
    accept: 'group',
    drop: (item: any) => {
      if (item.uuid === group.uuid) {
        return;
      }
      console.log('drop item:', JSON.stringify(item));
      (async () => {
        await main.conf.moveGroup(item.uuid, group.uuid);
        props.reloadConf();
      })();
    },
    collect: monitor => ({
      isOver: !!monitor.isOver(),
    }),
  }, [props.group]);

  const [{ isServerOver }, serverDrop] = useDrop({
    accept: 'server',
    drop: (item: any) => {
      console.log('drop item end:', JSON.stringify(item));
      (async () => {
        main.conf.moveServer(item.groupUuid, item.uuid, group.uuid, 'end');
        props.reloadConf();
      })();
    },
    collect: monitor => ({
      isServerOver: !!monitor.isOver(),
    }),
  }, [group.uuid]);


  const cardList = group.servers.map((server) => {
    server.groupUuid = group.uuid;
    server.groupName = groupName;
    return (
      <Grid item xs={4} sm={4} md={4} key={server.uuid + server.updateTime}>
        <ServerCard server={server} groupName={groupName} reloadConf={props.reloadConf} />
      </Grid>
    );
  });

  if (isDragging) {
    return <Box ref={dragPreviewRef}
      sx={{ width: '100%', height: '50px', backgroundColor: blue[50] }}></Box>
  }

  return (
    <Box style={{ opacity }}>
      <Box ref={drop}>
        {isOver && <LinearProgress variant="determinate" color="secondary" value={0} />}
        <Accordion expanded={expanded} onChange={
          (event, isExpanded) => {
            setExpanded(isExpanded);
          }} >
          <AccordionSummary
            onMouseEnter={() => { setMouseEnter(true) }}
            onMouseLeave={() => { setMouseEnter(false) }}
            ref={dragRef}
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1a-content"
            id="panel1a-header"
            sx={{ cursor: 'move' }}>
            {!editing &&
              <>
                <Box display='inline-flex' sx={{ width: '100%' }}>
                  <Box sx={{ marginRight: 1, opacity: mouseEnter ? 1 : 0 }}>
                    <DragIndicatorIcon color="disabled" />
                  </Box>
                  <Typography >{groupName}</Typography>

                  <Box sx={{ marginLeft: 2, marginRight: 2, opacity: mouseEnter ? 1 : 0 }} onClick={() => { setEditing(true) }}>
                    <EditIcon color="disabled" />
                  </Box>
                  <Box sx={{ float: 'right', opacity: mouseEnter ? 1 : 0 }} >
                    <DeleteIcon color="disabled" onClick={() => { deleteGroup() }} />
                  </Box>
                </Box>
              </>}
            {editing && <Box sx={{ width: '100%' }}>
              <ClickAwayListener onClickAway={() => { updateGroupName() }}>
                <TextField
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value.trim());
                  }} />
              </ClickAwayListener>
            </Box>
            }
          </AccordionSummary>
          <AccordionDetails >
            <Box>
              {expanded &&
                <Grid sx={{ flexGrow: 1 }} container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
                  {cardList}
                </Grid>
              }
              <Box ref={serverDrop}
                sx={{ width: '100%', height: '10px' }}>
                {isServerOver && <LinearProgress variant="determinate" color="secondary" value={0} />}
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box >
  );
}