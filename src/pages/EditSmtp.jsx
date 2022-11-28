import React, { useEffect, useState } from 'react';
import {
    EuiFieldPassword,
    EuiButton,
    EuiFieldText,
    EuiForm,
    EuiSwitch,
    EuiFormRow,
    EuiFlexGroup,
    EuiFieldNumber,
    EuiSpacer,
    EuiCheckbox,
    EuiFlexItem,
    EuiToolTip,
    EuiCode,
    EuiPage,
    EuiPageSection,
} from '@elastic/eui';

export function EditSmtp(props) {

    const [fromHost, setFromHost] = useState(undefined); // smtp
    const [fromPort, setFromPort] = useState(465);
    const [fromSecure, setFromSecure] = useState(true);
    const [fromEmail, setFromEmail] = useState(undefined);
    const [fromPassword, setFromPassword] = useState(undefined);
    const [etiquette, setEtiquette] = useState(undefined);


    let isSet = false;
    useEffect(() => {
        async function getSmtpc() {
            if (!isSet) {
                isSet = true;
                let smtpc = await window.config.getSmtpConfig();
                console.log("smtpc", smtpc);

                setFromHost(smtpc.fromHost); // smtp
                setFromPort(smtpc.fromPort);
                setFromSecure(smtpc.fromSecure);
                setFromEmail(smtpc.fromEmail);
                setFromPassword(smtpc.fromPassword);
                setEtiquette(smtpc.etiquette);
            }
        }
        getSmtpc();
    }, [])


    const submitFN = async () => {
        await window.config.putSmtpConfig({
            fromHost: fromHost,
            fromPort: fromPort,
            fromSecure: fromSecure,
            fromEmail: fromEmail,
            fromPassword: fromPassword,
            etiquette: etiquette,
        });
    };

    return (
        <EuiPageSection paddingSize='l' >
            <EuiForm component="form" >

                <EuiFormRow label="邮件 smtp 服务器" >
                    <EuiFieldText
                        placeholder='smtp.gmail.com'
                        value={fromHost}
                        onChange={(e) => setFromHost(e.target.value)} />
                </EuiFormRow>
                <EuiFormRow label="邮件 smtp 端口号" >
                    <EuiFieldText
                        placeholder='465'
                        value={fromPort}
                        onChange={(e) => setFromPort(e.target.value)} />
                </EuiFormRow>
                <EuiToolTip
                    position="top"
                    content={
                        <p>
                            一般端口是<EuiCode>465</EuiCode>就勾上，<EuiCode>587</EuiCode>或<EuiCode>25</EuiCode>就别勾了
                        </p>
                    }>
                    <EuiCheckbox
                        id='useSecure'
                        label='安全链接'
                        checked={fromSecure}
                        onChange={(e) => setFromSecure(e.target.checked)}
                    />
                </EuiToolTip>

                <EuiFormRow label='发件箱地址'>
                    <EuiFieldText
                        placeholder='alert@quant67.com'
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                    />
                </EuiFormRow>
                <EuiFormRow label='发件箱密码'>
                    <EuiFieldPassword
                        type='dual'
                        value={fromPassword}
                        onChange={(e) => setFromPassword(e.target.value)}
                    />
                </EuiFormRow>

                <EuiSpacer />
                <EuiSwitch label="礼仪"
                    checked={etiquette}
                    onChange={(e) => setEtiquette(e.target.checked)} />

                <EuiSpacer />
                <EuiButton
                    type='submit'
                    onClick={async (e) => {
                        e.preventDefault();
                        await submitFN()
                    }}>
                    保存
                </EuiButton>
            </EuiForm>
        </EuiPageSection>
    );
}

