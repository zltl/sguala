import React, { useEffect, useState } from 'react';
import {
    EuiFlexGroup, EuiFlexItem, EuiFlexGrid, EuiComboBox, EuiSpacer,
    euiPaletteColorBlind,
    euiPaletteColorBlindBehindText,
    EuiHealth,
    EuiHighlight,
} from '@elastic/eui';
import { ServerCard } from './ServerCard';

import { useTranslation } from 'react-i18next';


const visColors = euiPaletteColorBlind();
const visColorsBehindText = euiPaletteColorBlindBehindText();

export function ServerCardList(props) {
    const [servers, setServers] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [group, setGroup] = useState([]);
    const [groupList, setGroupList] = useState([]);

    if (props.setUpdateCB) {
        props.setUpdateCB(async () => {
            await loadConfig();
        });
    }
    const name = 'ServerCardList';

    const { t, i18n } = useTranslation();

    const loadConfig = async () => {
        const configs = await window.config.getAll();
        let curGroup = await window.fs.getCurGroup();
        if (!curGroup) {
            curGroup = [];
        }

        let grcnt = 0;
        const nextColor = () => {
            const oldidx = grcnt;
            grcnt = (grcnt + 1) % visColorsBehindText.length;
            return visColorsBehindText[oldidx];
        }

        // const color = visColorsBehindText[grcnt++];
        const color = nextColor();
        const groupList = [{
            label: t('all'), color: color, size: configs.servers.length,
        }];
        let servers = configs.servers;
        for (let j = 0; j < servers.length; j++) {
            const v = servers[j];
            if (!v.group || v.group.trim() == '') {
                continue;
            }
            let found = false;
            for (let i = 0; i < groupList.length; i++) {
                if (groupList[i].label == v.group) {
                    groupList[i].size++;
                    servers[j].color = groupList[i].color;
                    found = true;
                }
            }
            if (!found) {
                const color = nextColor();
                groupList.push({ label: v.group, color: color, size: 1 });
                servers[j].color = color;
            }
        }

        setServers(servers);
        setGroup(curGroup);
        setGroupList(groupList);
    }

    useEffect(() => {
        loadConfig();
    }, []);


    const itemFN = (item) => {
        let dotColor;
        if (item.color) {
            dotColor = visColors[visColorsBehindText.indexOf(item.color)];
        }
        return (
            <EuiFlexItem key={item.uuid + item.updateTime}>
                <ServerCard
                    color={dotColor}
                    isFirst={false}
                    login={item}
                    updateCardList={async () => {
                        await loadConfig();
                    }} />
            </EuiFlexItem>
        );
    }

    let srvs = [];

    const anyLabelHas = (arr, target) => {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i].label == target) {
                return true;
            }
        }
        return false;
    }

    if (anyLabelHas(group, t('all'))) {
        srvs = servers.map((item) => {
            itemFN(item);
        });
        servers.forEach((item) => {
            srvs.push(itemFN(item));
        });
    } else {
        for (let i = 0; i < group.length; i++) {
            const gs = group[i];
            const label = gs.label;
            servers.forEach((item) => {
                if (item.group == label) {
                    srvs.push(itemFN(item));
                }
            });
        }
    }

    const renderOption = (option, searchValue, contentClassName) => {
        const { color, label, size } = option;
        const dotColor = visColors[visColorsBehindText.indexOf(color)];
        return (
            <EuiHealth color={dotColor}>
                <span className={contentClassName}>
                    <EuiHighlight search={searchValue}>{label}</EuiHighlight>
                    &nbsp;
                    <span>({size})</span>
                </span>
            </EuiHealth>
        );
    }

    return (
        <div style={{
            padding: 20,
        }}>
            <EuiComboBox
                placeholder={t('All groups')}
                options={groupList}
                selectedOptions={group}
                prepend={t("Select groups")}
                onChange={(selectedOptions) => {
                    console.log('changing selected: ', selectedOptions);
                    setGroup(selectedOptions);
                    window.fs.setCurGroup(selectedOptions);
                }}
                renderOption={renderOption}
            />
            <EuiSpacer />
            <EuiFlexGrid gutterSize="s" columns={3}>
                {srvs}
            </EuiFlexGrid>
        </div >
    );

}