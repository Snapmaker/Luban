import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
// import { Modal as AModal } from 'antd';

class Body extends PureComponent {
    static propTypes = {
        children: PropTypes.node,
        key: PropTypes.string
    };

    static defaultProps = {
        key: 'modalBody'
    }

    render() {
        return (
            <div className="clearfix" id={this.props.key}>{this.props.children}</div>
        );
    }
}

export default Body;
