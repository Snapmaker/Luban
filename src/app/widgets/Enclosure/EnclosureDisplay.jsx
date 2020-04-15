import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import log from '../../lib/log';
import Enclosure from './Enclosure';
// import { actions as machineActions } from '../../flux/machine';
import { controller } from '../../lib/controller';

class EnclosureDisplay extends PureComponent {
    static propTypes = {
        setDisplay: PropTypes.func.isRequired,
        server: PropTypes.object.isRequired,
        isConnected: PropTypes.bool.isRequired,
        enclosureOnline: PropTypes.bool.isRequired,
        setTitle: PropTypes.func.isRequired,
        connectionType: PropTypes.string.isRequired
    }


    componentWillReceiveProps(nextProps) {
        if (!nextProps.isConnected) {
            this.props.setDisplay(false);
        }
        if (nextProps.enclosureOnline !== this.props.enclosureOnline
         && nextProps.enclosureOnline && this.props.connectionType === 'serial') {
            controller.writeln('M1010', { source: 'query' });
            this.props.setDisplay(true);
        }

        if (nextProps.isConnected && this.props.connectionType === 'wifi') {
            this.props.server.getEnclosureStatus((errMsg, res) => {
                if (errMsg) {
                    log.warn(errMsg);
                } else {
                    const { isReady } = res;
                    if (isReady === true) {
                        this.props.setDisplay(true);
                    }
                }
            });
        }
    }

    render() {
        return (
            <Enclosure
                setTitle={this.props.setTitle}
            />
        );
    }
}
const mapStateToProps = (state) => {
    const { server, isConnected, headType, connectionType, enclosureOnline, enclosureLight, enclosureFan } = state.machine;

    return {
        headType,
        enclosureOnline,
        enclosureLight,
        enclosureFan,
        isConnected,
        connectionType,
        server
    };
};


export default connect(mapStateToProps)(EnclosureDisplay);
