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
        size: PropTypes.string,
        marks: PropTypes.object,
        disabled: PropTypes.bool,
        value: PropTypes.number.isRequired
    };

    render() {
        const { className = '', disabled = false, vertical = false, marks, size = 'small', value, ...rest } = this.props;
        return (
            <div
                className={classNames(className, styles[size])}
            >
                <Slider
                    {...rest}
                    disabled={disabled}
                    marks={marks}
                    vertical={vertical}
                    className={classNames(styles.slider,)}
                    value={value}
                />
            </div>
        );
    }
}

export default SliderWrapper;
