import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import log from '../../../lib/log';
import Enclosure from './Enclosure';
import i18n from '../../../lib/i18n';

// import { actions as machineActions } from '../../flux/machine';
import { CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI } from '../../../constants';

class EnclosureDisplay extends PureComponent {
    static propTypes = {
        server: PropTypes.object.isRequired,
        isConnected: PropTypes.bool.isRequired,
        enclosureOnline: PropTypes.bool.isRequired,
        widgetActions: PropTypes.object.isRequired,
        connectionType: PropTypes.string.isRequired
    }

    componentDidMount() {
        this.props.widgetActions.setTitle(i18n._('Enclosure'));
        if (!this.props.isConnected) {
            this.props.widgetActions.setDisplay(false);
            return;
        }
        if (this.props.isConnected && this.props.enclosureOnline
            && this.props.connectionType === CONNECTION_TYPE_SERIAL) {
            this.props.widgetActions.setDisplay(true);
        }

        if (this.props.isConnected && this.props.connectionType === CONNECTION_TYPE_WIFI) {
            this.props.server.getEnclosureStatus((errMsg, res) => {
                if (errMsg) {
                    log.warn(errMsg);
                } else {
                    const { isReady } = res;
                    if (isReady === true) {
                        this.props.widgetActions.setDisplay(true);
                    }
                }
            });
        }
    }

    componentWillReceiveProps(nextProps) {
        if (!nextProps.isConnected) {
            this.props.widgetActions.setDisplay(false);
        }
        if (nextProps.enclosureOnline !== this.props.enclosureOnline && nextProps.isConnected
         && nextProps.enclosureOnline && this.props.connectionType === CONNECTION_TYPE_SERIAL) {
            this.props.widgetActions.setDisplay(true);
        }

        if (nextProps.isConnected && this.props.connectionType === CONNECTION_TYPE_WIFI) {
            this.props.server.getEnclosureStatus((errMsg, res) => {
                if (errMsg) {
                    log.warn(errMsg);
                } else {
                    const { isReady } = res;
                    if (isReady === true) {
                        this.props.widgetActions.setDisplay(true);
                    }
                }
            });
        }
    }

    render() {
        return (
            <Enclosure />
        );
    }
}
const mapStateToProps = (state) => {
    const { server, isConnected, headType, connectionType, enclosureOnline } = state.machine;

    return {
        headType,
        enclosureOnline,
        isConnected,
        connectionType,
        server
    };
};


export default connect(mapStateToProps)(EnclosureDisplay);
