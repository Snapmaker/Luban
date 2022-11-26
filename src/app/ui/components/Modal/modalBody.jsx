import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
// import { Modal as AModal } from 'antd';

class Body extends PureComponent {
    static propTypes = {
        children: PropTypes.node,
        className: PropTypes.string,
        style: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
        key: PropTypes.string
    };

    static defaultProps = {
        key: 'modalBody'
    };

    render() {
        return (
            <div
                id={this.props.key}
                style={this.props.style}
                className={classNames(this.props.className, 'clearfix')}
            >
                {this.props.children}
            </div>
        );
    }
}

export default Body;
