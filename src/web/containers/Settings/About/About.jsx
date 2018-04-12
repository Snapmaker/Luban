import React, { Component } from 'react';
import PropTypes from 'prop-types';
import shallowCompare from 'react-addons-shallow-compare';
import AboutContainer from './AboutContainer';
import HelpContainer from './HelpContainer';

class About extends Component {
    static propTypes = {
        initialState: PropTypes.object,
        state: PropTypes.object,
        stateChanged: PropTypes.bool,
        actions: PropTypes.object
    };

    componentDidMount() {
        const { actions } = this.props;
        actions.checkLatestVersion();
    }
    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    render() {
        const { state } = this.props;
        const { version } = state;

        return (
            <div>
                <AboutContainer version={version} />
                <HelpContainer />
            </div>
        );
    }
}

export default About;
