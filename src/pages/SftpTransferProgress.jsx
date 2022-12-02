import React, { useEffect, useState } from 'react';
import {
    EuiIcon,
    EuiProgress,
    EuiFlexGroup,
    EuiFlexItem,
} from '@elastic/eui';


export function SftpTransferProgress(props) {
    const [transfered, setTransfered] = useState(undefined);
    const [fsize, setFsize] = useState(undefined);
    const [speed, setSpeed] = useState('-');
    const [isEnd, setIsEnd] = useState(false);

    const msg = props.msg;

    useEffect(() => {
        window.ipc.on(msg.uuid, async (e, data) => {
            console.log('progress -- ', data);
            if (data.op != 'transferProgress') {
                return;
            }

            setTransfered(data.transfered);
            setFsize(data.fsize);
            setSpeed(data.speed);
            if (data.isEnd) {
                setIsEnd(data.isEnd);
            }
        });
        return () => {
            window.ipc.clear(msg.uuid);
        }
    }, []);


    return (
        <>
            <p>
                {msg.localFullPath}<EuiIcon
                    type={msg.transferType == 'get' ? "sortLeft" : "sortRight"}
                    style={{ marginLeft: '1em', marginRight: '1em' }}
                />{msg.remoteFullPath} <EuiIcon
                    type="minus"
                    style={{ marginLeft: '1em', marginRight: '1em' }}
                /> {speed}
            </p>

            <EuiProgress
                size='xs'
                max={isEnd ? 100 : fsize}
                value={isEnd ? 100 : transfered} />
        </>
    );
}