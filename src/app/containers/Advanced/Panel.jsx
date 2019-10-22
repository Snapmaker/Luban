import React, { PureComponent } from 'react';
import { Tabs, Tab } from 'react-bootstrap';
import DeveloperPanel from './DeveloperPanel';
import styles from './index.styl';
import i18n from '../../lib/i18n';

class Panel extends PureComponent {
    render() {
        return (
            <Tabs className={styles['primary-tab']} id="primary-tabs">
                <Tab
                    eventKey="basic"
                    title={i18n._('Basic')}
                >
                    <DeveloperPanel />
                </Tab>
                <Tab
                    eventKey="basic2"
                    title={i18n._('Basic2')}
                >
                    <DeveloperPanel />
                </Tab>
            </Tabs>
        );
    }
}

export default Panel;
