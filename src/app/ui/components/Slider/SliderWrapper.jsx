// import { Checkbox } from 'antd';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Slider } from 'antd';

import styles from './styles.styl';

// const { TabPane } = Tabs;

class SliderWrapper extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        vertical: PropTypes.bool,
        handleStyle: PropTypes.string,
        value: PropTypes.number.isRequired
    };

    render() {
        const { className = '', vertical = false, value, ...rest } = this.props;
        return (
            <Slider
                {...rest}
                vertical={vertical}
                className={classNames(styles.slider, className)}
                value={value}
            />
        );
    }
}

export default SliderWrapper;
