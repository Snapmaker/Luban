import mapValues from 'lodash/mapValues';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../../lib/i18n';
import mapGCodeToText from '../../../lib/gcode-text';
import Anchor from '../../components/Anchor';
import { TextInput } from '../../components/Input';
import {
    HEAD_LASER,
    HEAD_CNC
} from '../../../constants';


class MachineModal extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        controllerState: PropTypes.object,
        expanded: PropTypes.bool.isRequired,
        toggleMachineModalSection: PropTypes.func.isRequired
    };

    render() {
        const { headType, controllerState, expanded, toggleMachineModalSection } = this.props;
        const isLaser = (headType === HEAD_LASER);
        const isCNC = (headType === HEAD_CNC);
        const none = '–';
        const modal = mapValues(controllerState.modal || {}, mapGCodeToText);
        if (isLaser) {
            switch (controllerState.modal.spindle) {
                case 'M3':
                    modal.spindle = i18n._('Power On (M3)', { ns: 'gcode' });
                    break;
                case 'M5':
                    modal.spindle = i18n._('Power Off (M5)', { ns: 'gcode' });
                    break;
                default:
                    modal.spindle = i18n._('Power Off (M5)', { ns: 'gcode' });
                    break;
            }
        }

        return (
            <React.Fragment>
                <Anchor className="sm-parameter-header" onClick={toggleMachineModalSection}>
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('key-unused-Machine Model')}</span>
                    <span className={classNames(
                        'fa',
                        expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {expanded && (
                    <React.Fragment>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('key-unused-Motion')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.motion || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('key-unused-Distance')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.distance || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('key-unused-Feed Rate')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.feedrate || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('key-unused-Unit')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.units || none} />
                        </div>
                        {isLaser && (
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('key-unused-Laser')}</span>
                                <TextInput className="sm-parameter-row__input-lg" disabled value={modal.spindle || none} />
                            </div>
                        )}
                        {isCNC && (
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('key-unused-Spindle')}</span>
                                <TextInput className="sm-parameter-row__input-lg" disabled value={modal.spindle || none} />
                            </div>
                        )}
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }
}

export default MachineModal;
