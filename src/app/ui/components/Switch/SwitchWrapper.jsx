// import { Checkbox } from 'antd';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Switch } from 'antd';

import styles from './styles.styl';

class SwitchWrapper extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        checked: PropTypes.bool,
        checkedChildren: PropTypes.string,
        unCheckedChildren: PropTypes.string
    };

    render() {
        const { className = '', checked, checkedChildren = '', unCheckedChildren = '', ...rest } = this.props;
        // TODO style
        return (
            <Switch
                {...rest}
                checked={checked}
                checkedChildren={checkedChildren}
                unCheckedChildren={unCheckedChildren}
                className={classNames(styles.switch, className)}
            />
        );
    }
}

export default SwitchWrapper;
