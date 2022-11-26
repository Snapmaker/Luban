import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

// import { Modal as AModal } from 'antd';

class Title extends PureComponent {
    static propTypes = {
        children: PropTypes.node,
        key: PropTypes.string
    };

    static defaultProps = {
        key: 'modalTitle'
    };

    render() {
        return (
            <div id={this.props.key}>{this.props.children}</div>
        );
    }
}

export default Title;
