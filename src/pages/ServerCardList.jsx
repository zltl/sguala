import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiFlexGrid } from '@elastic/eui';
import { ServerCard } from './ServerCard';


export class ServerCardList extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            servers: [],
            alerts: [],
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
        this.setState(() => {
            return {
                servers: configs.servers,
            };
        });
    }


    async componentDidMount() {
        await this.loadConfig();
    }

    render() {
        let first = true;
        const srvs = this.state.servers.map((item) => {
            let isFirst = first;
            if (first) {
                first = false;
            }
            return (
                <EuiFlexItem key={JSON.stringify(item)}>
                    <ServerCard
                        isFirst={isFirst}
                        login={item}
                        updateCardList={async () => {
                            await this.loadConfig();
                        }} />
                </EuiFlexItem>
            );
        });

        return (
            <div style={{
                padding: 20,
            }}>
                <EuiFlexGrid gutterSize="s" columns={3}>
                    {srvs}
                </EuiFlexGrid>
            </div >
        );
    }


}