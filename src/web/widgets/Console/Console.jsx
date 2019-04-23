import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../reducers/machine';
import Terminal from './Terminal';
import styles from './index.styl';
import { ABSENT_OBJECT } from '../../constants';

class Console extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object,
        setTerminal: PropTypes.func.isRequired,

        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    terminal = null;

    actions = {
        onTerminalData: (data) => {
            this.props.executeGcode(data);
        }
    };

    componentDidMount() {
        this.props.setTerminal(this.terminal);
    }

    render() {
        const { state } = this.props;
        const { port, server } = this.props;

        if (!port && server === ABSENT_OBJECT) {
            this.terminal = null;
            this.props.setTerminal(null);

            return (
                <div className={styles.noSerialConnection}>
                    {i18n._('No connection')}
                </div>
            );
        }

        return (
            <Terminal
                ref={node => {
                    if (node && !this.terminal) {
                        this.terminal = node;
                        this.props.setTerminal(node);
                    }
                }}
                cursorBlink={state.terminal.cursorBlink}
                scrollback={state.terminal.scrollback}
                tabStopWidth={state.terminal.tabStopWidth}
                onData={this.actions.onTerminalData}
            />
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { port, server } = machine;

    return {
        port,
        server
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Console);
