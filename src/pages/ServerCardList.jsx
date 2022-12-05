import React from 'react';
import {
    EuiFlexGroup, EuiFlexItem, EuiFlexGrid, EuiComboBox, EuiSpacer,
    euiPaletteColorBlind,
    euiPaletteColorBlindBehindText,
    EuiHealth,
    EuiHighlight,
} from '@elastic/eui';
import { ServerCard } from './ServerCard';

const visColors = euiPaletteColorBlind();
const visColorsBehindText = euiPaletteColorBlindBehindText();

export class ServerCardList extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            servers: [],
            alerts: [],
            group: [],
        };
        this.loadConfig = this.loadConfig.bind(this);
        if (props.setUpdateCB) {
            props.setUpdateCB(async () => {
                await this.loadConfig();
            });
        }
        this.name = 'ServerCardList';
    }

    async loadConfig() {
        const configs = await window.config.getAll();
        let curGroup = await window.fs.getCurGroup();
        if (!curGroup) {
            curGroup = [];
        }

        const groupList = [];
        let grcnt = 0;
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
                const color = visColorsBehindText[grcnt++];
                groupList.push({ label: v.group, color: color, size: 1 });
                servers[j].color = color;
            }
        }

        this.setState(() => {
            return {
                servers: servers,
                group: curGroup,
                groupList: groupList,
            };
        });
    }

    async componentDidMount() {
        await this.loadConfig();
    }

    render() {
        let first = true;

        const itemFN = (item) => {
            let isFirst = first;
            if (first) {
                first = false;
            }
            let dotColor;
            if (item.color) {
                dotColor = visColors[visColorsBehindText.indexOf(item.color)];
            }
            return (
                <EuiFlexItem key={JSON.stringify(item)}>
                    <ServerCard
                        color={dotColor}
                        isFirst={isFirst}
                        login={item}
                        updateCardList={async () => {
                            await this.loadConfig();
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

        if (!this.state.group || this.state.group.length == 0 ||
            anyLabelHas(this.state.group, '所有')) {

            srvs = this.state.servers.map(itemFN);
        } else {
            console.log('for each ', this.state.group);
            for (let i = 0; i < this.state.group.length; i++) {
                const gs = this.state.group[i];
                const label = gs.label;
                this.state.servers.forEach((item) => {
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
                    placeholder='所有分组'
                    options={this.state.groupList}
                    selectedOptions={this.state.group}
                    prepend="选择分组"
                    onChange={(selectedOptions) => {
                        console.log('changing selected: ', selectedOptions);
                        this.setState({
                            group: selectedOptions
                        });
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


}