import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';

class AppLayout extends PureComponent {
    static propTypes = {
        children: PropTypes.array.isRequired
    };


    render() {
        return (
            <div>
                {this.props.children}
            </div>

        );
    }
}

export default withRouter(AppLayout);
