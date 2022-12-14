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


import { useTranslation } from 'react-i18next';

export function EditAlert(props) {
    const { t, i18n } = useTranslation();

    let alerts = {};

    const [isOpen, setIsOpen] = useState(false);
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
                setToEmail(alerts.toEmail);

                setCpuCheck(!!alerts.cpuCheck);
                setMemCheck(!!alerts.memCheck);
                setDiskCheck(!!alerts.diskCheck);

                setCpuAlertValue(alerts.cpuAlertValue || 90);
                setMemAlertValue(alerts.memAlertValue || 90);
                setDiskAlertValue(alerts.diskAlertValue || 90);
                setCpuAlertForValue(alerts.cpuAlertForValue || 5);
                setMemAlertForValue(alerts.memAlertForValue || 5);
                setDiskAlertForValue(alerts.diskAlertForValue || 5);

                setUpCheck(!!alerts.upCheck);
                setUpAlertForValue(alerts.upAlertForValue || 5);

                setMailInterval(alerts.mailInterval || 120);
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

            updateTime: new Date(),
        });
    };

    return (
        <EuiForm component="form" >

            <EuiSwitch
                label={t('Enable')}
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
                                prepend={t('CPU usage exceeds')}
                                value={cpuAlertValue}
                                onChange={(e) => setCpuAlertValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={'%'
                                }
                            />
                        </EuiFlexItem>
                        <EuiFlexItem>
                            <EuiFieldNumber
                                prepend={t('for')}
                                style={{ width: '4em' }}
                                value={cpuAlertForValue}
                                onChange={(e) => setCpuAlertForValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={t('minute')}
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
                                prepend={t('Memory usage exceeds')}
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
                                prepend={t('for')}
                                value={memAlertForValue}
                                onChange={(e) => setMemAlertForValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={
                                    t('minute')
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
                                prepend={t('Disk usage exceeds')}
                                value={diskAlertValue}
                                onChange={(e) => setDiskAlertValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={'%'}
                            />
                        </EuiFlexItem>
                        <EuiFlexItem>
                            <EuiFieldNumber
                                style={{ width: '4em' }}
                                prepend={t('for')}
                                value={diskAlertForValue}
                                onChange={(e) => setDiskAlertForValue(parseFloat(e.target.value))}
                                aria-label="select alert value"
                                append={t('minute')}
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
                        prepend={t('Server disconnect for')}
                        value={upAlertForValue}
                        onChange={(e) => setUpAlertForValue(parseFloat(e.target.value))}
                        aria-label="select alert value"
                        append={t('minute')}
                    />
                }
                checked={upCheck}
                onChange={(e) => setUpCheck(e.target.checked)}
            />

            <EuiSpacer />

            <EuiFormRow label={t('Email address for receiving alerts')}>
                <EuiFieldText
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                />
            </EuiFormRow>

            <EuiSpacer />
            <EuiFieldNumber
                prepend={t('Alerts email of this server should not be resend in')}
                value={mailInterval}
                onChange={(e) => setMailInterval(parseFloat(e.target.value))}
                aria-label="select alert value"
                append={
                    t('minutes')
                }
            />

            <EuiSpacer />
            <EuiButton
                type='submit'
                onClick={async (e) => {
                    e.preventDefault();
                    await submitFN()
                }}>
                {t('Save')}
            </EuiButton>
        </EuiForm>
    );
}

