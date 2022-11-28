import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Resizable } from "re-resizable";
import ResizeObserver from "react-resize-observer";

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
        // this.term.write('Connecting ...\n');
        this.fitAddon.fit();
        this.term.onData(async (data) => {
            window.ipc.send(chanKey, {
                'op': 'data',
                'data': data.toString(),
            });
            console.log("this is data:", data);
        })
    }

    render() {
        return (<>
            <Resizable>
                <div id="xterm" style={{ width: '100vw', height: '100vh' }} ref={c => this.XtermDiv = c} />
            </Resizable>
            <ResizeObserver
                onResize={rect => {
                    this.fitAddon.fit();
                    console.log("Resized. New bounds:", rect.width, "x", rect.height);
                }}
                onPosition={rect => {
                    console.log("Moved. New position:", rect.left, "x", rect.top);
                }}
            />
        </>);
    }
}
