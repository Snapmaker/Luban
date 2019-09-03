import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

// import { NumberInput } from '../../components/Input';
import { actions as machineActions } from '../../flux/machine';
import styles from './index.styl';


class DeveloperPanel extends PureComponent {
    static propTypes = {
        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    /*
    state = {
    };
    */

    actions = {
        switch: () => {
            const data = 'M1024';
            this.props.executeGcode(data);
        },
        home: () => {
            const data = 'G28';
            this.props.executeGcode(data);
        },
        jog: () => {
            const data = 'G1 X5';
            const { port, server } = this.props;
            console.log('ps', port, server, data);
            this.props.executeGcode(data);
        },
        jogZ: () => {
            const data = 'G1 Z5';
            const { port, server } = this.props;
            console.log('ps', port, server, data);
            this.props.executeGcode(data);
        },
        startManualCalibration: () => {
            const data = 'start manual calibration';
            this.props.executeGcode(data);
        },
        startAutoCalibration: () => {
            const data = 'start auto calibration';
            this.props.executeGcode(data);
        },
        gotoCalibrationPoint: () => {
            const data = 'goto calibration point1';
            this.props.executeGcode(data);
        },
        moveCalibrationPoint: () => {
            const data = 'move calibration point1';
            this.props.executeGcode(data);
        },
        resetCalibration: () => {
            const data = 'reset calibration';
            this.props.executeGcode(data);
        },
        exitCalibration: () => {
            const data = 'exit calibration';
            this.props.executeGcode(data);
        },
        saveCalibration: () => {
            const data = 'save calibration';
            this.props.executeGcode(data);
        }
    };

    /*
    constructor(props) {
        super(props);
    }
    */

    componentDidMount() {
    }

    setMode() {
        // this.mode = mode;
    }

    render() {
        console.log('render');
        return (
            <div className={styles['laser-table']}>
                <div className={styles['laser-table-row']}>
                    <div className={styles['svg-control-bar']}>
                        <p>Developer Panel</p>
                        <button type="button" onClick={() => this.actions.switch()}>Switch</button>
                        <button type="button" onClick={() => this.actions.jog()}>JogX</button>
                        <button type="button" onClick={() => this.actions.home()}>Home</button>
                        <button type="button" onClick={() => this.actions.startAutoCalibration()}>Start Auto Calibration</button>
                        <button type="button" onClick={() => this.actions.gotoCalibrationPoint()}>Goto Calibration</button>
                        <button type="button" onClick={() => this.actions.moveCalibrationPoint()}>Move Calibration</button>
                        <button type="button" onClick={() => this.actions.resetCalibration()}>Reset Calibration</button>
                        <button type="button" onClick={() => this.actions.exitCalibration()}>Exit Calibration</button>
                        <button type="button" onClick={() => this.actions.saveCalibration()}>Save Calibration</button>
                        <button type="button" onClick={() => this.actions.jogZ()}>Z Up</button>
                        <button type="button" onClick={() => this.actions.jogZ()}>Z Down</button>
                    </div>
                </div>
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


export default connect(mapStateToProps, mapDispatchToProps)(DeveloperPanel);

// export default DeveloperPanel;
