import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { parse as queryParse } from 'querystring';

import React from 'react';

import "./xterm.css";


export class MyTerminal extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.term = null;
        this.fitAddon = new FitAddon();
    }

    componentDidMount() {
        console.log(global.location.search);
        let query = queryParse(global.location.search);
        console.log(query);
        const uuid = query['?uuid'];
        const shellCnt = query['shellCnt'];
        const login = window.config.get(uuid).then((login) => {
            document.title = login.name;
        });
        const chanKey = 'SHELL_CHANNEL_' + uuid + '/' + shellCnt;
        console.log("chanKey=", chanKey)

        window.ipc.on(chanKey, (e, data) => {
            if (data.op == 'data') {
                this.term.write(data.data);
            }
        });

        this.term = new Terminal();
        this.term.loadAddon(this.fitAddon);
        this.term.open(this.XtermDiv);

        this.term.onResize((arg1) => {
            console.log("RESIZE: ", JSON.stringify(arg1));
            window.ipc.send(chanKey, {
                'op': 'resize',
                'data': '',
                'rows': arg1.rows,
                'cols': arg1.cols,
            });
        });
        window.addEventListener('resize', () => {
            this.fitAddon.fit();
        });
        // this.term.write('Connecting ...\n');
        this.fitAddon.fit();

        this.term.onData(async (data) => {
            window.ipc.send(chanKey, {
                'op': 'data',
                'data': data.toString(),
            });
            // console.log("this is data:", data);
        })
    }

    render() {
        return (
            <div id="xterm" style={{ margin: 0, height: '100%' }} ref={c => this.XtermDiv = c} />
        );
    }
}
