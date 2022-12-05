import React, { useState } from 'react';
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
} from '@elastic/eui';

export function EditServer(props) {
  const [serverName, setServerName] = useState(props.name);
  const [serverHost, setServerHost] = useState(props.host);
  const [serverPort, setServerPort] = useState(props.port ? props.port : 22);
  const [usePassword, setUsePassword] = useState(props.usePassword);
  const [serverUsername, setServerUsername] = useState(
    props.username ? props.username : 'root');
  const [serverPassword, setServerPassword] = useState(props.password);
  const [serverKey, setServerKey] = useState(props.privateKey);

  const [group, setGroup] = useState(props.groupo);

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
    });
    await props.updateCardList();
  };

  return (
    <EuiForm component="form" >
      <EuiFormRow label="名称">
        <EuiFieldText
          placeholder="起个响亮的名字"
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
        />
      </EuiFormRow>
      
      <EuiFormRow
        label="分组">
        <EuiFieldText
          placeholder="分组名称"
          value={group}
          onChange={(e) => setGroup(e.target.value)} />
      </EuiFormRow>

      <EuiFormRow label="服务器地址">
        <EuiFieldText
          placeholder="IP 地址或域名"
          value={serverHost}
          onChange={(e) => setServerHost(e.target.value)}
        />
      </EuiFormRow>

      <EuiFormRow label="端口号">
        <EuiFieldNumber
          value={serverPort}
          onChange={(e) => setServerPort(Number(e.target.value))}
        />
      </EuiFormRow>

      <EuiFormRow label="用户名">
        <EuiFieldText
          placeholder="用户名"
          value={serverUsername}
          onChange={(e) => setServerUsername(e.target.value)}
        />
      </EuiFormRow>

      <EuiSpacer />
      <EuiCheckbox id="checkUserPassword"
        label="使用密码，而不是私钥"
        checked={usePassword}
        onChange={(e) => setUsePassword(e.target.checked)}
      />

      <EuiFormRow label={usePassword ? "密码" : "私钥"} >
        {usePassword ?
          <EuiFieldPassword
            placeholder="服务器密码"
            type={'dual'}
            value={serverPassword}
            onChange={(e) => setServerPassword(e.target.value)}
          />
          :
          <EuiTextArea
            placeholder="私钥 PEM 文件内容粘贴到这里"
            value={serverKey}
            onChange={(e) => setServerKey(e.target.value)}
          />
        }
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

