import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

class Footer extends PureComponent {
    static propTypes = {
        children: PropTypes.node,
        key: PropTypes.string
    };

    static defaultProps = {
        key: 'modalFooter'
    };

    render() {
        return (
            <div id={this.props.key} className=" align-r">
                {this.props.children}
            </div>
        );
    }
}

export default Footer;
