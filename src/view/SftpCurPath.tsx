import React from "react";
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/base/ClickAwayListener';
import { TextField, InputBase } from "@mui/material";


export function SftpCurPath({ path, setPath }: { path: string, setPath: (path: string) => void }) {
  const [useTexField, setUseTexField] = React.useState<boolean>(false);
  const [inputText, setInputText] = React.useState<string>(path);

  const pathList = path.split('/');

  React.useEffect(() => {
    setInputText(path);
  }, [path]);

  return (
    <div style={{height: '30px'}}>
      {useTexField && <ClickAwayListener
        onClickAway={() => { setPath(inputText); setUseTexField(false); }}>
        <Box>
          <InputBase style={{ width: '100%', flex: 1 }}
            value={inputText}
            inputRef={input => input && input.focus()}
            onChange={(e) => { setInputText(e.target.value.trim()) }} />
        </Box>
      </ClickAwayListener>}
      {!useTexField && <div style={{ display: 'flex', width: '100%' }}>
        <Box sx={{ width: '10px' }} onClick={() => { setPath('/'); setUseTexField(false); }}></Box>
        <Breadcrumbs maxItems={10000}>
          {pathList.map((p, i) => (
            <Box key={i} sx={{ cursor: 'pointer' }}
              onClick={() => {
                const newPath = pathList.slice(0, i + 1).join('/');
                setPath(newPath);
                setUseTexField(false);
              }}
            ><Typography>{p}</Typography></Box>
          ))}
        </Breadcrumbs><div
          onClick={() => {
            setUseTexField(true);
          }} style={{ flexGrow: 1 }}></div>
      </div>}
    </div>
  );
}
