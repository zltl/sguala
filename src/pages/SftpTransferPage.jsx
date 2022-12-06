import React, { useEffect, useState } from 'react';
import {
    EuiProvider,
    EuiPage,
    EuiPageBody,
    EuiText,
    EuiResizableContainer,
    EuiPanel,
    EuiIcon,
    EuiPagination,
    EuiFieldText,
    EuiDraggable,
    EuiFormRow,
    EuiDragDropContext,
    EuiDroppable,
    euiTheme,
    EuiLink,
    EuiProgress,
    EuiButtonIcon,
} from '@elastic/eui';
import { parse as queryParse } from 'querystring';
import { SftpTransferProgress } from './SftpTransferProgress';

let query = queryParse(global.location.search);
console.log(query);
const uuid = query['?uuid'];
const shellCnt = query['shellCnt'];
const login = window.config.get(uuid).then((login) => {
    document.title = 'sftp/' + login.name;
});
const chanKey = 'SHELL_CHANNEL_' + uuid + '/' + shellCnt;

export function SftpTransferPage(props) {

    const [localCurDir, setLocalCurDir] = useState('.');
    const [fileList, setFileList] = useState([]);

    const [remoteCurDir, setRemoteCurDir] = useState('.');
    const [remoteFileList, setRemoteFileList] = useState([]);

    const [localCurLoading, setLocalCurLoading] = useState(false);
    const [remoteCurLoading, setRemoteCurLoading] = useState(false);

    const [transferList, setTransferList] = useState([]);

    const th3Height = window.innerHeight / 3;


    const getCurDir = async () => {
        const curdir = await window.fs.getCurDir();
        setLocalCurDir(curdir);
    }

    const getRemoteCurDir = async () => {
        console.log("getRemoteCurDir");
        window.ipc.send(chanKey, {
            'op': 'realPath',
            'data': remoteCurDir,
        });
    }
    const lsDirRemote = async (dir) => {
        console.log("remote lsDir");
        window.ipc.send(chanKey, {
            'op': 'ls',
            'data': dir,
        });
    }

    const getRemoteFile = async (local, remote) => {
        window.ipc.send(chanKey, {
            'op': 'get',
            'remoteDesc': remote,
            'localPath': local,
        })
        return;
    }

    const putRemoteFile = async (remote, local) => {
        window.ipc.send(chanKey, {
            'op': 'put',
            'localDesc': local,
            'remotePath': remote,
        })
        return;
    }


    const updateFileList = async () => {
        const flist = await window.fs.listDir(localCurDir);
        console.log("flist", flist);
        setFileList(flist);
    }

    useEffect(() => {
        window.ipc.on(chanKey, async (e, data) => {
            console.log('chans', data);
            switch (data.op) {
                case 'realPath': {
                    setRemoteCurDir(data.data);
                    await lsDirRemote(data.data);
                    break;
                }
                case 'ls': {
                    setRemoteFileList(data.data);
                    setTimeout(() => {
                        setRemoteCurLoading(false);
                    }, 1000);
                    break;
                }
                case 'ready': {
                    await getRemoteCurDir();
                    break;
                }
                case 'transferStart': {
                    console.log('transferStart');
                    setTransferList((prevs) => [...prevs, data]);
                    /*
                        'op': 'transferStart',
                        'transferType': 'get',
                        'remoteFullPath': remoteDesc.fullPath,
                        'localFullPath': localPathConc,
                        'uuid': curUUID,
                    */
                }
            }
        });

        getCurDir();
        getRemoteCurDir();

        return () => {
            window.ipc.clear(chanKey);
        }
    }, []);

    useEffect(() => {
        updateFileList();
    }, [localCurDir]);


    const tryUpdateCur = async () => {
        setLocalCurLoading(true);
        await window.fs.setCurDir(localCurDir);
        await getCurDir();
        await updateFileList();
        setTimeout(() => {
            setLocalCurLoading(false);
        }, 1000);
    }

    const tryUpdateRemoteCur = async () => {
        setRemoteCurLoading(true);
        getRemoteCurDir();
    }

    const onDragEnd = ({ source, destination }) => {
        console.log("source", source);
        console.log("dest", destination);
        if (!source || !destination) {
            return;
        }
        if (source.droppableId == destination.droppableId) {
            return;
        }

        if (source.name == '..') {
            console.log('error transfer ..');
            return;
        }

        if (source.droppableId == 'REMOTE_D_AREA') {
            const fromDesc = remoteFileList[source.index];
            const destPath = localCurDir;


            console.log("from: ", fromDesc, 'to', destPath);
            getRemoteFile(destPath, fromDesc);
        } else if (source.droppableId == 'LOCAL_D_AREA') {
            const fromDesc = fileList[source.index];
            const destPath = remoteCurDir;
            console.log("from: ", fromDesc, 'to', destPath);
            putRemoteFile(destPath, fromDesc);
        }
    };

    const pgList = transferList.map((elem) => {
        return (
            <div key={elem.uuid} style={{ marginBottom: "0.3em" }}>
                <SftpTransferProgress
                    msg={elem}
                />
            </div>
        );
    });

    return (
        <EuiDragDropContext onDragEnd={onDragEnd} >

            <EuiResizableContainer direction='vertical' style={{ height: '100vh' }}>
                {(EPannel, EButton) => (
                    <>
                        <EPannel
                            paddingSize='none'
                            initialSize={th3Height * 2}
                            minSize="200px"
                            grow={false}
                            style={{ overflow: 'hidden' }} >
                            <EuiResizableContainer
                                wrapperPadding='none'
                                paddingSize='none'
                                style={{ width: '100%', height: '100%' }}>
                                {(UPan, UBut) => (
                                    <>
                                        <UPan initialSize={window.innerWidth / 2}
                                            minSize="100px">
                                            <EuiDroppable
                                                style={{ height: '100%' }}
                                                droppableId='LOCAL_D_AREA'
                                                spacing='m'
                                                withPanel={false}
                                                grow={false}>
                                                <EuiPanel
                                                    style={{ height: '100%', overflow: 'hidden' }}>
                                                    <EuiFieldText
                                                        fullWidth={true}
                                                        placeholder="本地当前目录"
                                                        value={localCurDir}
                                                        onChange={(e) => setLocalCurDir(e.target.value)}
                                                        onBlur={tryUpdateCur}
                                                        aria-label="current dir"
                                                        append={
                                                            <EuiButtonIcon
                                                                aria-label='refresh local dir'
                                                                iconType="refresh"
                                                                onClick={tryUpdateCur} />
                                                        }
                                                    />
                                                    {localCurLoading && <EuiProgress
                                                        size="xs"
                                                        color="accent" />}

                                                    <div
                                                        style={{ height: '100%', overflow: 'auto' }}
                                                        className="eui-yScroll">
                                                        {fileList.map((finfo, idx) => (
                                                            <EuiDraggable
                                                                spacing='m'
                                                                key={finfo.fullPath}
                                                                index={idx}
                                                                draggableId={"l:" + finfo.fullPath}
                                                            >
                                                                {(provided, state) => {
                                                                    if (finfo.isDir) {
                                                                        return (<EuiLink color="primary"
                                                                            onClick={() => {
                                                                                setLocalCurDir(finfo.fullPath);
                                                                            }}>
                                                                            <EuiIcon type="folderClosed" />
                                                                            <span>
                                                                                {' ' + finfo.name}
                                                                                {state.isDragging && ' ✨'}
                                                                            </span>
                                                                        </EuiLink>);
                                                                    } else {
                                                                        return (
                                                                            <>
                                                                                <EuiIcon type="document" color='text' />
                                                                                <span style={{ color: '#343741' }}>
                                                                                    {' ' + finfo.name}
                                                                                    {state.isDragging && ' ✨'}
                                                                                </span>
                                                                            </>
                                                                        );
                                                                    }
                                                                }}
                                                            </EuiDraggable>
                                                        ))}
                                                    </div>
                                                </EuiPanel>
                                            </EuiDroppable>
                                        </UPan>

                                        <UBut />

                                        <UPan initialSize={window.innerWidth / 2} minSize="100px" style={{ overflow: 'hidden' }}>
                                            <EuiDroppable
                                                droppableId='REMOTE_D_AREA'
                                                style={{ height: '100%', overflow: 'hidden' }}
                                                spacing='m'
                                                grow={false}>

                                                <EuiPanel className="eui-yScroll" style={{ height: '100%', overflow: 'hidden' }}>
                                                    <EuiFieldText
                                                        fullWidth={true}
                                                        placeholder="远程当前目录"
                                                        value={remoteCurDir}
                                                        onChange={(e) => setRemoteCurDir(e.target.value)}
                                                        onBlur={tryUpdateRemoteCur}
                                                        aria-label="remote current dir"
                                                        append={
                                                            <EuiButtonIcon
                                                                aria-label='refresh remote dir'
                                                                iconType="refresh"
                                                                onClick={tryUpdateRemoteCur} />
                                                        }
                                                    />
                                                    {remoteCurLoading && <EuiProgress
                                                        size="xs"
                                                        color="accent" />}


                                                    <div
                                                        style={{ height: '100%', overflow: 'auto' }}
                                                        className="eui-yScroll">
                                                        {remoteFileList.map((finfo, idx) => (
                                                            <EuiDraggable spacing='m' key={finfo.fullPath} index={idx} draggableId={"r:" + finfo.fullPath}>
                                                                {(provided, state) => {
                                                                    if (finfo.isDir) {
                                                                        return (<EuiLink color="primary"
                                                                            onClick={() => {
                                                                                window.ipc.send(chanKey, {
                                                                                    'op': 'realPath',
                                                                                    'data': finfo.fullPath,
                                                                                });
                                                                            }}>
                                                                            <EuiIcon type="folderClosed" />
                                                                            <span>
                                                                                {' ' + finfo.name}
                                                                                {state.isDragging && ' ✨'}
                                                                            </span>
                                                                        </EuiLink>);
                                                                    } else {
                                                                        return (
                                                                            <>
                                                                                <EuiIcon type="document" color='text' />
                                                                                <span style={{ color: '#343741' }}>
                                                                                    {' ' + finfo.name}
                                                                                    {state.isDragging && ' ✨'}
                                                                                </span>
                                                                            </>
                                                                        );
                                                                    }
                                                                }}
                                                            </EuiDraggable>
                                                        ))}
                                                    </div>

                                                </EuiPanel>
                                            </EuiDroppable>
                                        </UPan>
                                    </>
                                )}
                            </EuiResizableContainer>

                        </EPannel>

                        <EButton />

                        <EPannel initialSize={th3Height}  >

                            <EuiDroppable
                                droppableId='TRAN_STATUS_AREA'
                                style={{ height: '100%', overflow: 'hidden' }}
                                spacing='m'
                                grow={false}>

                                <EuiPanel style={{ height: '100%', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', overflow: 'auto' }}
                                        className="eui-yScroll">

                                        {pgList}


                                    </div>
                                </EuiPanel>

                            </EuiDroppable>

                        </EPannel>
                    </>
                )}
            </EuiResizableContainer>
        </EuiDragDropContext >
    );
}

