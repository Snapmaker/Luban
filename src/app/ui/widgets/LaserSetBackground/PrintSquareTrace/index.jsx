import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Slider from '../../../components/Slider';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';
import styles from '../styles.styl';
import { actions as workspaceActions } from '../../../../flux/workspace';
import PrintPreview from './PrintPreview';


function generateSquareGcode(size, sideLength, power) {
    // M3: laser on
    // M5: laser off
    const gcodeArray = [];
    const p0 = {
        x: (size.x - sideLength) / 2,
        y: (size.y - sideLength) / 2
    };
    const p1 = {
        x: p0.x + sideLength,
        y: p0.y
    };
    const p2 = {
        x: p0.x + sideLength,
        y: p0.y + sideLength
    };
    const p3 = {
        x: p0.x,
        y: p0.y + sideLength
    };
    // power in percentage
    // priority: P > S, for compatibility, use both P and S args.
    const powerStrength = Math.floor(power * 255 / 100);
    const workSpeed = 1500;

    gcodeArray.push(';Laser Square G-code');
    gcodeArray.push(`;powerPercent: ${power}`);
    gcodeArray.push(`;workSpeed: ${workSpeed}`);

    gcodeArray.push('M5'); // Turn off laser if it's turned on

    // move x&y to zero
    gcodeArray.push('G91'); // relative position
    gcodeArray.push(`G0 X${-size.x - 10} F400`);
    gcodeArray.push('G0 X8');
    gcodeArray.push(`G0 Y${-size.y - 10} F400`);
    gcodeArray.push('G0 Y2');

    gcodeArray.push(`G0 F${workSpeed}`);
    gcodeArray.push(`G1 F${workSpeed}`);

    gcodeArray.push('G90'); // absolute position
    gcodeArray.push('G21'); // set units to mm
    gcodeArray.push('G92 X0 Y0'); // set work origin

    gcodeArray.push(`G0 X${p0.x} Y${p0.y}`);
    // set M3 power
    gcodeArray.push(`M3 P${power} S${powerStrength}`);
    gcodeArray.push(`G1 X${p0.x} Y${p0.y}`);
    gcodeArray.push(`G1 X${p1.x} Y${p1.y}`);
    gcodeArray.push(`G1 X${p2.x} Y${p2.y}`);
    gcodeArray.push(`G1 X${p3.x} Y${p3.y}`);
    gcodeArray.push(`G1 X${p0.x} Y${p0.y}`);
    gcodeArray.push('M5');
    // Push plate out & move laser head to left for taking photo
    gcodeArray.push(`G0 X0 Y${size.y}`);
    gcodeArray.push('\n');
    return gcodeArray.join('\n');
}


class PrintSquareTrace extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        hideModal: PropTypes.func.isRequired,
        renderGcode: PropTypes.func.isRequired,
        clearGcode: PropTypes.func.isRequired,
        executeCmd: PropTypes.func.isRequired,
        state: PropTypes.shape({
            sideLength: PropTypes.number.isRequired
        }),
        actions: PropTypes.shape({
            changeSideLength: PropTypes.func.isRequired,
            checkConnectionStatus: PropTypes.func.isRequired
        })
    };

    state = {
        power: 68
    };

    actions = {
        setSideLength: (sideLength) => {
            this.props.actions.changeSideLength(sideLength);
        },
        setPower: (power) => {
            this.setState({ power });
        },
        printSquareTrace: () => {
            if (!this.props.actions.checkConnectionStatus()) {
                return;
            }
            const { size } = this.props;
            const { power } = this.state;
            const { sideLength } = this.props.state;

            const gcodeStr = generateSquareGcode(size, sideLength, power);
            this.props.clearGcode();
            this.props.renderGcode(gcodeStr);

            setTimeout(() => {
                this.props.executeCmd('gcode:start');
            }, 1000);
        }
    };

    render() {
        const { size } = this.props;
        const actions = { ...this.props.actions, ...this.actions };
        const state = { ...this.props.state, ...this.state };

        const maxSideLength = Math.min(size.x, size.y);
        const minSideLength = Math.min(maxSideLength / 2, maxSideLength);

        return (
            <Modal style={{ width: '480px', height: '720px' }} size="lg" onClose={this.props.hideModal}>
                <div className="clearfix" />
                <Modal.Header>
                    {i18n._('key-Laser/CameraCaptureOriginal-Engrave Square')}
                </Modal.Header>

                <Modal.Body>
                    <div style={{ textAlign: 'center' }}>
                        <PrintPreview
                            size={size}
                            sideLength={this.props.state.sideLength}
                            width={400}
                            height={400}
                        />
                    </div>
                    <div className="margin-top-16 margin-left-16">
                        <table className={styles['parameter-table']}>
                            <tbody>
                                <tr>
                                    <td>
                                        {i18n._('key-Laser/CameraCaptureOriginal-Side Length')}
                                    </td>
                                    <td>
                                        <Slider
                                            className="margin-right-8 float-r"
                                            value={this.props.state.sideLength}
                                            min={minSideLength}
                                            max={maxSideLength}
                                            onChange={actions.setSideLength}
                                        />
                                    </td>
                                    <td>
                                        <Input
                                            value={this.props.state.sideLength}
                                            min={minSideLength}
                                            max={maxSideLength}
                                            onChange={actions.setSideLength}
                                            suffix="mm"
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        {i18n._('key-Laser/CameraCaptureOriginal-LaserPower')}
                                    </td>
                                    <td>
                                        <Slider
                                            className="margin-right-8 float-r"
                                            value={state.power}
                                            min={0.1}
                                            max={100}
                                            onChange={actions.setPower}
                                        />
                                    </td>
                                    <td>
                                        <Input
                                            min={0.1}
                                            max={100}
                                            value={state.power}
                                            onChange={actions.setPower}
                                            suffix="%"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <Button
                        priority="level-three"
                        width="160px"
                        type="default"
                        className="float-l margin-top-16 margin-left-16"
                        onClick={actions.printSquareTrace}
                    >
                        {i18n._('key-Laser/CameraCaptureOriginal-Engrave Square Trace')}
                    </Button>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        width="96px"
                        priority="level-two"
                        onClick={actions.displayExtractTrace}
                    >
                        {i18n._('key-Laser/CameraCaptureOriginal-Next')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    return {
        size: machine.size
    };
};

const mapDispatchToProps = (dispatch) => ({
    renderGcode: (gcode) => dispatch(workspaceActions.renderGcode('', gcode, true)),
    executeCmd: (cmd) => dispatch(workspaceActions.executeCmd(cmd)),
    clearGcode: () => dispatch(workspaceActions.clearGcode())
});


export default connect(mapStateToProps, mapDispatchToProps)(PrintSquareTrace);
