import React, { useState } from 'react';
import {
    EuiTextArea,
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
    EuiTitle,
    EuiFlexItem,
    EuiToolTip,
    EuiCode,
} from '@elastic/eui';

export async function EditAlert(props) {


    const alerts = await window.config.getAlert(props.uuid);

    const [isOpen, setIsOpen] = useState(alerts.isOpen);
    const [fromHost, setFromHost] = useState(alerts.fromHost); // smtp
    const [fromPort, setFromPort] = useState(alerts.fromPort);
    const [fromSecure, setFromSecure] = useState(alerts.fromSecure);
    const [fromEmail, setFromEmail] = useState(alerts.fromEmail);
    const [fromPassword, setFromPassword] = useState(alerts.fromPassword);
    const [toEmail, setToEmail] = useState(alerts.toEmail);

    const [cpuCheck, setCpuCheck] = useState(alerts.cpuCheck);
    const [memCheck, setMemCheck] = useState(alerts.memCheck);
    const [diskCheck, setDiskCheck] = useState(alerts.diskCheck);

    const [cpuAlertValue, setCpuAlertValue] = useState(alerts.cpuAlertValue ? alerts.cpuAlertValue : 90);
    const [memAlertValue, setMemAlertValue] = useState(alerts.memAlertValue ? alerts.memAlertValue : 90);
    const [diskAlertValue, setDiskAlertValue] = useState(alerts.diskAlertValue ? alerts.diskAlertValue : 90);
    const [cpuAlertForValue, setCpuAlertForValue] = useState(alerts.cpuAlertForValue ? alerts.cpuAlertForValue : 5);
    const [memAlertForValue, setMemAlertForValue] = useState(alerts.memAlertForValue ? alerts.memAlertForValue : 5);
    const [diskAlertForValue, setDiskAlertForValue] = useState(alerts.diskAlertForValue ? alerts.diskAlertForValue : 5);

    const [upCheck, setUpCheck] = useState(alerts.upCheck);
    const [upAlertForValue, setUpAlertForValue] = useState(alerts.upAlertForValue);
    const [mailInterval, setMailInterval] = useState(alert.mailInterval);
    // TODO: form



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

            cpuAlertValue: cpuAlertValue,
            memAlertValue: memAlertValue,
            diskAlertValue: diskAlertValue,
            cpuAlertForValue: cpuAlertForValue,
            memAlertForValue: memAlertForValue,
            diskAlertForValue: diskAlertForValue,

        });
        await props.updateCardList();
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

