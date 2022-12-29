import React, { useEffect, useState } from 'react';
import {
  EuiTextArea,
  EuiFieldPassword,
  EuiButton,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiFieldNumber,
  EuiSpacer,
  EuiCheckbox,
  EuiSelect,
} from '@elastic/eui';
import { useTranslation } from 'react-i18next';

export function EditServer(props) {

  const { t, i18n } = useTranslation();


  const [serverName, setServerName] = useState(props.name);
  const [serverHost, setServerHost] = useState(props.host);
  const [serverPort, setServerPort] = useState(props.port ? props.port : 22);
  const [usePassword, setUsePassword] = useState(props.usePassword);
  const [serverUsername, setServerUsername] = useState(
    props.username ? props.username : 'root');
  const [serverPassword, setServerPassword] = useState(props.password);
  const [serverKey, setServerKey] = useState(props.privateKey);
  const [useHopping, setUseHopping] = useState(props.useHopping);
  const [hoppingID, setHoppingID] = useState(props.hoppingID);
  const [hoppingOptions, setHoppingOptions] = useState([]);

  const [group, setGroup] = useState(props.group);

  const submitFN = async () => {
    props.closePopover();
    console.log("... CLOSE POP UP")
    await window.config.set({
      uuid: props.uuid,
      name: serverName,
      host: serverHost,
      port: serverPort,
      password: serverPassword,
      username: serverUsername,
      privateKey: serverKey,
      usePassword: usePassword,
      group: group,
      updateTime: new Date().toISOString(),
      useHopping: useHopping,
      hoppingID: hoppingID,
    });
    await props.updateCardList();
  };

  const loadHops = async (ok) => {
    // load config
    const configs = await window.config.getAll();
    let servers = configs.servers;
    let options = [];
    for (let j = 0; j < servers.length; j++) {
      const sv = servers[j];
      if (sv.useHopping) {
        continue;
      }
      options.push({
        value: sv.uuid,
        text: sv.name
      });
    }
    setHoppingOptions(options);
  };

  useEffect(() => {
    loadHops(true);
  }, []);

  return (
    <EuiForm component="form" >
      <EuiFormRow label={t('Name')}>
        <EuiFieldText
          placeholder={t('Name the server')}
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
        />
      </EuiFormRow>

      <EuiFormRow
        label={t('Group')}>
        <EuiFieldText
          placeholder={t('Set group name')}
          value={group}
          onChange={(e) => setGroup(e.target.value)} />
      </EuiFormRow>

      <EuiCheckbox id="checkboxUseTunnel"
        label={t('Use hopping')}
        checked={useHopping}
        onChange={(e) => setUseHopping(e.target.checked)}
      />
      {useHopping &&
        <EuiFormRow label={t('Hopping Server')}>
          <EuiSelect
            id="useHopSelectServer"
            options={hoppingOptions}
            value={hoppingID}
            onChange={(e) => setHoppingID(e.target.value)}
            aria-label="use hopping server"
          />
        </EuiFormRow>
      }


      <EuiFormRow label={t('Server Address')}>
        <EuiFieldText
          placeholder={t('IP or domain name')}
          value={serverHost}
          onChange={(e) => setServerHost(e.target.value)}
        />
      </EuiFormRow>

      <EuiFormRow label={t('Port')}>
        <EuiFieldNumber
          value={serverPort}
          onChange={(e) => setServerPort(Number(e.target.value))}
        />
      </EuiFormRow>

      <EuiFormRow label={t("User name")}>
        <EuiFieldText
          placeholder={t("User name")}
          value={serverUsername}
          onChange={(e) => setServerUsername(e.target.value)}
        />
      </EuiFormRow>

      <EuiSpacer />
      <EuiCheckbox id="checkUserPassword"
        label={t('Use password instead of private key')}
        checked={usePassword}
        onChange={(e) => setUsePassword(e.target.checked)}
      />

      <EuiFormRow label={usePassword ? t('Password') : t('Private key')} >
        {usePassword ?
          <EuiFieldPassword
            placeholder={t('Password')}
            type={'dual'}
            value={serverPassword}
            onChange={(e) => setServerPassword(e.target.value)}
          />
          :
          <EuiTextArea
            placeholder={t("Content of private key (pem)")}
            value={serverKey}
            onChange={(e) => setServerKey(e.target.value)}
          />
        }
      </EuiFormRow>


      <EuiButton
        type='submit'
        onClick={(e) => {
          e.preventDefault();
          submitFN()
        }}>
        {t("Save")}
      </EuiButton>
    </EuiForm>
  );
}

