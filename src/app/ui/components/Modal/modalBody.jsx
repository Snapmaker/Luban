import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
// import { Modal as AModal } from 'antd';

class Body extends PureComponent {
    static propTypes = {
        children: PropTypes.node,
        className: PropTypes.string,
        key: PropTypes.string
    };

    static defaultProps = {
        key: 'modalBody'
    }

    render() {
        return (
            <div
                id={this.props.key}
                className={classNames(this.props.className, 'clearfix')}
            >
                {this.props.children}
            </div>
        );
    }
}

export default Body;
