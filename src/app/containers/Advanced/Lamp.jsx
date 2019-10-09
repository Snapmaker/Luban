import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { NumberInput } from '../../components/Input';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class Lamp extends PureComponent {
    static propTypes = {
        // onchangeCncRpm: PropTypes.func,
        // controllerState: PropTypes.object,
        // rpm: PropTypes.number,
        executeGcode: PropTypes.func,
        // changeLightOnoff: PropTypes.func,
        setLightMode: PropTypes.func
    };

    state = {
        brightness: 50,
        lightStatus: false
    };

    actions = {
        onchangeBrightness: (brightness) => {
            this.setState({ brightness });
        },
        changeLightOnoff: (value) => {
            const checkLightStatus = document.getElementById('lightStatus');
            console.log(checkLightStatus.checked, value);

            if (checkLightStatus.checked) {
                this.props.executeGcode('set light status', { lightStatus: true });
            } else {
                this.props.executeGcode('set light status', { lightStatus: false });
            }
        }
    }

    render() {
        // const { onchangeCncRpm, controllerState } = this.props;
        return (
            <div>
                <div>
                    <p>{i18n._('lamp')}</p>
                    <ul style={{ listStyle: 'none' }}>
                        <li>
                            <button className={styles['btn-func']} type="button" onClick={() => this.props.executeGcode('get light status')}>
                                Get Light Status
                            </button>
                        </li>
                        <li>
                            <NumberInput
                                className={styles['input-setting']}
                                value={this.state.brightness}
                                onChange={this.actions.onchangeBrightness}
                            />
                            <input
                                type="checkbox"
                                id="lightStatus"
                                checked={this.state.lightStatus}
                                onChange={this.actions.changeLightOnoff}
                            />
                                Light On
                            <br />
                        </li>
                        <li>
                            <input type="radio" name="browser" onClick={() => this.props.setLightMode('status')} />
                                Status
                            <br />
                            <input type="radio" name="browser" onClick={() => this.props.setLightMode('light')} />
                                Light
                            <br />
                        </li>
                    </ul>
                </div>
            </div>
        );
    }
}

export default Lamp;
