import { EuiPageSection, EuiListGroup, EuiListGroupItem, EuiSpacer, EuiCode, EuiPanel } from '@elastic/eui';
import React, { useEffect, useState } from 'react';


export function Abount(props) {

    const [version, setVersion] = useState('');

    useEffect(() => {
        window.config.getVersion().then((v) => {
            setVersion(v);
            console.log("version=", v);
        });
    }, []);


    return (
        <EuiPageSection>
            <EuiPanel>
                <p>sguala {version}</p>
                <EuiSpacer />

                <p>sguala is a remote linux system monitor distribute as GPL-3.0.</p>
                <EuiSpacer />
                <p>GPL-3.0 means there are four freedoms that every user should have</p>
                <ol>
                    <li>the freedom to use the software for any purpose,</li>
                    <li>the freedom to change the software to suit your needs,</li>
                    <li>the freedom to share the software with your friends and neighbors, and</li>
                    <li>the freedom to share the changes you make.</li>
                </ol>

                <EuiSpacer />
                <p>Relate links：</p>
                <EuiListGroup>
                    <EuiListGroupItem
                        label='Source Code: https://github.com/zltl/sguala'
                        size='s'
                    />
                    <EuiListGroupItem
                        label='GPL-3.0: https://www.gnu.org/licenses/gpl-3.0.txt'
                        size='s'
                    />
                </EuiListGroup>
                <EuiSpacer />

                <p>All dependencies are list on<EuiCode>package.json</EuiCode> file, checkout if you interested.
                    The major dependencies are list below:</p>

                <EuiListGroup>
                    <EuiListGroupItem
                        label='electron: https://www.electronjs.org/'
                        size='s'
                    />
                    <EuiListGroupItem
                        label='React: https://reactjs.org/'
                        size='s'
                    />
                    <EuiListGroupItem
                        label='elastic/eui: https://github.com/elastic/eui'
                        size='s'
                    />
                    <EuiListGroupItem
                        label='ssh2: https://github.com/mscdex/ssh2'
                        size='s'
                    />

                </EuiListGroup>
            </EuiPanel>
        </EuiPageSection>
    );
}

