import React, { useState } from 'react';
import {
  EuiTextArea,
  EuiFieldPassword,
  EuiSwitch,
  EuiPopover,
  EuiPopoverTitle,
  EuiPopoverFooter,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTextColor,
  EuiButtonIcon,
  EuiCheckboxGroup,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiFilePicker,
  EuiLink,
  EuiFieldNumber,
  EuiRange,
  EuiSelect,
  EuiSpacer,
  EuiCheckbox,
  EuiText,
  useGeneratedHtmlId,
} from '@elastic/eui';

export function EditServer() {

  const [serverName, setServerName] = useState(undefined);
  const [serverHost, setServerHost] = useState(undefined);
  const [serverPort, setServerPort] = useState(22);
  const [usePassword, setUsePassword] = useState(false);
  const [serverUsername, setServerUsername] = useState('root');
  const [serverPassword, setServerPassword] = useState(undefined);
  const [serverKey, setServerKey] = useState(undefined);


  return (
    <EuiForm>
      <EuiFormRow label="名称">
        <EuiFieldText
          placeholder="起个响亮的名字"
          value={serverName}
          onChange={(e:React.ChangeEvent<HTMLInputElement>) => setServerName(e.target.value) }
        />
      </EuiFormRow>
      <EuiFormRow label="服务器地址">
        <EuiFieldText
          placeholder="IP 地址或域名"
          value={serverHost}
          onChange={(e:React.ChangeEvent<HTMLInputElement>) => setServerHost(e.target.value) }
        />
      </EuiFormRow>

      <EuiFormRow label="端口号">
        <EuiFieldNumber
          value={serverPort}
          onChange={(e:React.ChangeEvent<HTMLInputElement>) => setServerPort(Number(e.target.value)) }
        />
      </EuiFormRow>

      <EuiFormRow label="用户名">
        <EuiFieldText
          placeholder="用户名"
          value={serverUsername}
          onChange={(e:React.ChangeEvent<HTMLInputElement>) => setServerUsername(e.target.value) }
        />
      </EuiFormRow>

      <EuiSpacer/>
      <EuiCheckbox id="checkUserPassword"
                   label="使用密码，而不是私钥"
                   checked={usePassword}
                   onChange={(e:React.ChangeEvent<HTMLInputElement>) => setUsePassword(e.target.checked) }
      />

      <EuiFormRow label={usePassword?"密码":"私钥"} >
        {usePassword?
         <EuiFieldPassword
           placeholder="服务器密码"
           type={'dual'}
           value={serverPassword}
           onChange={(e:React.ChangeEvent<HTMLInputElement>) => setServerPassword(e.target.value)}
         />
        :
         <EuiTextArea
           placeholder="私钥 PEM 文件内容粘贴到这里"
           value={serverKey}
           onChange={(e:React.ChangeEvent<HTMLTextAreaElement>) => setServerKey(e.target.value)}
         />
        }
      </EuiFormRow>

      <EuiButton>
        保存
      </EuiButton>
    </EuiForm>
  );
}

