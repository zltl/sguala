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
} from '@elastic/eui';

export function EditAlert(props) {

    let alerts = {};

    const [isOpen, setIsOpen] = useState(false);
    const [fromHost, setFromHost] = useState(undefined); // smtp
    const [fromPort, setFromPort] = useState(465);
    const [fromSecure, setFromSecure] = useState(true);
    const [fromEmail, setFromEmail] = useState(undefined);
    const [fromPassword, setFromPassword] = useState(undefined);
    const [toEmail, setToEmail] = useState(undefined);

    const [cpuCheck, setCpuCheck] = useState(false);
    const [memCheck, setMemCheck] = useState(false);
    const [diskCheck, setDiskCheck] = useState(false);

    const [cpuAlertValue, setCpuAlertValue] = useState(90);
    const [memAlertValue, setMemAlertValue] = useState(90);
    const [diskAlertValue, setDiskAlertValue] = useState(90);
    const [cpuAlertForValue, setCpuAlertForValue] = useState(5);
    const [memAlertForValue, setMemAlertForValue] = useState(5);
    const [diskAlertForValue, setDiskAlertForValue] = useState(5);

    const [upCheck, setUpCheck] = useState(false);
    const [upAlertForValue, setUpAlertForValue] = useState(5);
    const [mailInterval, setMailInterval] = useState(120);

    let isSet = false;
    useEffect(() => {
        async function getAlerts() {
            if (!isSet) {
                isSet = true;
                alerts = await window.config.getAlert(props.uuid);
                console.log('getAlerts: ', alerts);
                if (!alerts) {
                    return;
                }
                setIsOpen(!!alerts.isOpen);
                setFromHost(alerts.fromHost); // smtp
                setFromPort(alerts.fromPort);
                setFromSecure(alerts.fromSecure);
                setFromEmail(alerts.fromEmail);
                setFromPassword(alerts.fromPassword);
                setToEmail(alerts.toEmail);

                setCpuCheck(!!alerts.cpuCheck);
                setMemCheck(!!alerts.memCheck);
                setDiskCheck(!!alerts.diskCheck);

                setCpuAlertValue(alerts.cpuAlertValue);
                setMemAlertValue(alerts.memAlertValue);
                setDiskAlertValue(alerts.diskAlertValue);
                setCpuAlertForValue(alerts.cpuAlertForValue);
                setMemAlertForValue(alerts.memAlertForValue);
                setDiskAlertForValue(alerts.diskAlertForValue);

                setUpCheck(!!alerts.upCheck);
                setUpAlertForValue(alerts.upAlertForValue);

                setMailInterval(alerts.mailInterval);
            }
        }
        getAlerts();
    }, [])



    const submitFN = async () => {
        props.closePopover();
        console.log("... CLOSE POP ALERT UP")
        await window.config.pubAlert({
            uuid: props.uuid,
            isOpen: isOpen,
            fromHost: fromHost,
            fromPort: fromPort,
            fromSecure: fromSecure,
            fromEmail: fromEmail,
            fromPassword: fromPassword,
            toEmail: toEmail,

            cpuCheck: cpuCheck,
            memCheck: memCheck,
            diskCheck: diskCheck,
            upCheck: upCheck,

            cpuAlertValue: cpuAlertValue,
            memAlertValue: memAlertValue,
            diskAlertValue: diskAlertValue,
            cpuAlertForValue: cpuAlertForValue,
            memAlertForValue: memAlertForValue,
            diskAlertForValue: diskAlertForValue,
            upAlertForValue: upAlertForValue,
            mailInterval: mailInterval,

        });
    };

    return (
        <EuiForm component="form" >

            <EuiSwitch
                label="启用"
                checked={isOpen}
                onChange={(e) => setIsOpen(e.target.checked)}
            />

            <EuiSpacer />

            <EuiCheckbox
                id='cpuCheck'
                label={
                    <EuiFlexGroup>
                        <EuiFlexItem>
                            <EuiFieldNumber
                                style={{ width: '6em' }}
                                prepend={'CPU 占用率超过'}
                                value={cpuAlertValue}
                                onChange={(e) => setCpuAlertValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={'%'
                                }
                            />
                        </EuiFlexItem>
                        <EuiFlexItem>
                            <EuiFieldNumber
                                prepend={'持续'}
                                style={{ width: '4em' }}
                                value={cpuAlertForValue}
                                onChange={(e) => setCpuAlertForValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={
                                    '分钟'
                                }
                            />
                        </EuiFlexItem>
                    </EuiFlexGroup>
                }
                checked={cpuCheck}
                onChange={(e) => setCpuCheck(e.target.checked)}
            />
            <EuiSpacer />

            <EuiCheckbox
                id='memCheck'
                label={
                    <EuiFlexGroup>
                        <EuiFlexItem>
                            <EuiFieldNumber
                                style={{ width: '6em' }}
                                prepend={'内存占用率超过'}
                                value={memAlertValue}
                                onChange={(e) => setMemAlertValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={'%'
                                }
                            />
                        </EuiFlexItem>
                        <EuiFlexItem>
                            <EuiFieldNumber
                                style={{ width: '4em' }}
                                prepend={'持续'}
                                value={memAlertForValue}
                                onChange={(e) => setMemAlertForValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={
                                    '分钟'
                                }
                            />
                        </EuiFlexItem>
                    </EuiFlexGroup>
                }
                checked={memCheck}
                onChange={(e) => setMemCheck(e.target.checked)}
            />
            <EuiSpacer />

            <EuiCheckbox
                id='diskCheck'
                label={
                    <EuiFlexGroup>
                        <EuiFlexItem>
                            <EuiFieldNumber
                                style={{ width: '6em' }}
                                prepend={'磁盘占用率超过'}
                                value={diskAlertValue}
                                onChange={(e) => setDiskAlertValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={'%'
                                }
                            />
                        </EuiFlexItem>
                        <EuiFlexItem>
                            <EuiFieldNumber
                                style={{ width: '4em' }}
                                prepend={'持续'}
                                value={diskAlertForValue}
                                onChange={(e) => setDiskAlertForValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={
                                    '分钟'
                                }
                            />
                        </EuiFlexItem>
                    </EuiFlexGroup>
                }
                checked={diskCheck}
                onChange={(e) => setDiskCheck(e.target.checked)}
            />
            <EuiSpacer />
            <EuiCheckbox
                id='upCheck'
                label={
                    <EuiFieldNumber
                        prepend={'服务器连不上持续'}
                        value={upAlertForValue}
                        onChange={(e) => setUpAlertForValue(parseFloat(e.target.value))}
                        aria-label="select alert value"
                        append={'分钟'}
                    />
                }
                checked={upCheck}
                onChange={(e) => setUpCheck(e.target.checked)}
            />

            <EuiSpacer />

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

            <EuiFormRow label='收件箱地址'>
                <EuiFieldText
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                />
            </EuiFormRow>

            <EuiSpacer />
            <EuiFieldNumber
                prepend={'这个服务器的告警邮件'}
                value={mailInterval}
                onChange={(e) => setMailInterval(parseFloat(e.target.value))}
                aria-label="select alert value"
                append={
                    '分钟内不用再发'
                }
            />

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
    );
}

