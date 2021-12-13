import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Cascader } from 'antd';
import classNames from 'classnames';
import styles from './styles.styl';

class ChangedReactCascader extends PureComponent {
    static propTypes = {
        placement: PropTypes.string,
        className: PropTypes.string,
        options: PropTypes.array,
        value: PropTypes.number,
        onChange: PropTypes.func,
        dropdownRender: PropTypes.func
    };

    render() {
        return (
            <div className={classNames(styles['override-cascader'], this.props.className)}>
                <Cascader
                    className="display-inline"
                    allowClear={false}
                    changeOnSelect
                    placement={this.props.placement ?? 'bottomRight'}
                    dropdownRender={this.props.dropdownRender}
                    options={this.props.options}
                    value={[this.props.value]}
                    onChange={this.props.onChange}
                />
            </div>
        );
    }
}

export default ChangedReactCascader;
