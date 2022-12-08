import { EuiPageSection, EuiListGroup, EuiListGroupItem, EuiSpacer, EuiCode } from '@elastic/eui';
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
            <p>小凶许运维 {version}</p>
            <EuiSpacer />

            <p>小凶许是遵守 GPL-3.0 许可证开发的自由软件，用于监控你的服务器资源。</p>
            <EuiSpacer />
            <p>GPL-3.0 许可证意味着你收到此软件时，同时也会收到一份软件源代码，同时你将拥有四项基本权利：</p>
            <ol>
                <li>1. 自由运行软件</li>
                <li>2. 自由学习和修改软件源代码</li>
                <li>3. 自由再发布软件拷贝</li>
                <li>4. 自由发布修改后的软件版本</li>
            </ol>
            <p>同时，基于此软件的修改、衍生、再发布都需要遵守 GPL-3.0 协议。</p>

            <EuiSpacer />
            <p>相关链接：</p>
            <EuiListGroup>
                <EuiListGroupItem
                    label='软件源代码'
                    href='https://github.com/zltl/sguala'
                    iconType='link'
                    size='s'
                />
                <EuiListGroupItem
                    label='GPL-3.0 协议全文'
                    href='https://www.gnu.org/licenses/gpl-3.0.txt'
                    iconType='link'
                    size='s'
                />
            </EuiListGroup>
            <EuiSpacer />

            <p>这个项目主要使用了下列开源项目，大概是要声明的。
                当然也不会把全部依赖都列出来因为超级多，
                更详细的依赖列表去看源代码<EuiCode>package.json</EuiCode>
                文件好了</p>

            <EuiListGroup>
                <EuiListGroupItem
                    label='electron - 使用前端结束开发 PC 应用'
                    href='https://www.electronjs.org/'
                    iconType='link'
                    size='s'
                />
                <EuiListGroupItem
                    label='React - 用于构成界面的前端库'
                    href='https://reactjs.org/'
                    iconType='link'
                    size='s'
                />
                <EuiListGroupItem
                    label='elastic/eui - 基于 React 的前端组件集合'
                    href='https://github.com/elastic/eui'
                    iconType='link'
                    size='s'
                />
                <EuiListGroupItem
                    label='ssh2 - 使用 ssh 协议连接服务器'
                    href='https://github.com/mscdex/ssh2'
                    iconType='link'
                    size='s'
                />

            </EuiListGroup>
        </EuiPageSection>
    );
}

