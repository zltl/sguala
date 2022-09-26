import React from 'react';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import { ServerCard } from './ServerCard';


export class ServerCardList extends React.Component {

    constructor(props) {
        console.log('new ServerCardList()....................');
        super(props);
        this.state = {
            servers: [],
        };
        this.loadConfig = this.loadConfig.bind(this);
        if (props.setUpdateCB) {
            props.setUpdateCB(async () => {
                console.log("CB LOAD_CONFIG_ALL");
                await this.loadConfig();
            });
        }
        this.name = 'ServerCardList';
    }

    async loadConfig() {
        const configs = await window.config.getAll();
        console.log("loadConfig -------------", this.name, configs);
        this.setState({ servers: configs.servers });
    }


    async componentDidMount() {
        await this.loadConfig();
        /*
        const timerfn = async () => {
            await this.loadConfig();
            setTimeout(() => { timerfn() }, 10 * 1000);
        };
        await timerfn();
        */
    }

    render() {
        const srvs = this.state.servers.map((item) => {
            return (
                <EuiFlexItem key={item.uuid}>
                    <ServerCard login={item}
                        updateCardList={() => this.props.updateCardList()} />
                </EuiFlexItem>
            );
        });

        return (
            <EuiFlexGroup>
                {srvs}
            </EuiFlexGroup>
        );
    }


}