import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { parse as queryParse } from 'querystring';

import React from 'react';

export const MyTerminal = (props) => {
    const xtermRef = React.useRef(null);
    let openSsh = false;

    console.log(global.location.search);
    let query = queryParse(global.location.search);
    console.log(query);
    const uuid = query['?uuid'];
    let term = undefined;
    let fitAddon = undefined;

    React.useEffect(async () => {
        const login = await window.config.get(uuid);
        document.title = login.name;
        console.log("------------log=", login);
        // You can call any method in XTerm.js by using 'xterm xtermRef.current.terminal.[What you want to call]
        // xtermRef.current.terminal.writeln("Hello, World!");

        if (!term) {
            term = new Terminal();
            fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(document.getElementById('terminal-container'));
            // Make the terminal's size and geometry fit the size of #terminal-container
        }
        fitAddon.fit();

        if (!openSsh) {
            // ipcRenderer.on('your-event', (event, customData) => cb(customData));
        }
    }, [])

    return (
        // Create a new terminal and set it's ref.
        <div id='terminal-container' style={{ width: '100vw', height: '100vh' }}></div>
    )
}
