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

        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    terminal = null;

    actions = {
        onTerminalData: (data) => {
            this.props.executeGcode(data);
        },
        // TODO
        clearTerminal: () => {
            this.terminal && this.terminal.clear();
        }
    };

    render() {
        const { state } = this.props;
        const { port, server } = this.props;

        if (!port && server === ABSENT_OBJECT) {
            return (
                <div className={styles.noSerialConnection}>
                    {i18n._('No connection')}
                </div>
            );
        }

        return (
            <div>
                <Terminal
                    ref={node => {
                        if (node) {
                            this.terminal = node;
                        }
                    }}
                    cursorBlink={state.terminal.cursorBlink}
                    scrollback={state.terminal.scrollback}
                    tabStopWidth={state.terminal.tabStopWidth}
                    onData={this.actions.onTerminalData}
                />
                {/*
                <div style={{ position: 'absolute', top: '0', right: '0', margin: '10px' }}>
                    <button
                        type="button"
                        className="fa fa-ban fa-flip-horizontal"
                        onClick={this.actions.clearTerminal}
                    />
                </div>
                */}
            </div>
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
