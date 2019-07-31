import mapValues from 'lodash/mapValues';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../lib/i18n';
import mapGCodeToText from '../../lib/gcode-text';
import Anchor from '../../components/Anchor';
import { TextInput } from '../../components/Input';
import {
    HEAD_3DP
} from './constants';


class MachineModal extends PureComponent {
    static propTypes = {
        headType: PropTypes.string,
        controllerState: PropTypes.object,
        expanded: PropTypes.bool.isRequired,
        toggleMachineModalSection: PropTypes.func.isRequired
    };

    render() {
        const { headType, controllerState, expanded, toggleMachineModalSection } = this.props;
        const is3DP = (headType === HEAD_3DP);

        const none = '–';
        const modal = mapValues(controllerState.modal || {}, mapGCodeToText);

        return (
            <React.Fragment>
                <Anchor className="sm-parameter-header" onClick={toggleMachineModalSection}>
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Machine Modal')}</span>
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
                            <span className="sm-parameter-row__label">{i18n._('Motion')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.motion || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Distance')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.distance || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Feed Rate')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.feedrate || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Unit')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.units || none} />
                        </div>
                        {!is3DP && (
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('{{headType}}', { headType })}</span>
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
