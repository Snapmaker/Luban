// import { Checkbox } from 'antd';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Tabs } from 'antd';

import styles from './styles.styl';

const { TabPane } = Tabs;

class TabsWrapper extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        activeKey: PropTypes.string.isRequired,
        options: PropTypes.array.isRequired
    };

    render() {
        const { className = '', options, activeKey, ...rest } = this.props;
        return (
            <Tabs
                {...rest}
                activeKey={activeKey}
                className={classNames(styles.tabs, className)}
            >
                {(options.map((option) => {
                    return (<TabPane key={option.key} tab={option.tab} />);
                }))}
            </Tabs>
        );
    }
}

export default TabsWrapper;
