import mapValues from 'lodash/mapValues';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../lib/i18n';
import mapGCodeToText from '../../lib/gcode-text';
import Anchor from '../../components/Anchor';
import { TextInput } from '../../components/Input';


class MachineModal extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        enabled: PropTypes.bool.isRequired,
        toggleMachineModalSection: PropTypes.func.isRequired
    };

    render() {
        const { state, enabled, toggleMachineModalSection } = this.props;
        const none = '–';
        const modal = mapValues(state.modal || {}, mapGCodeToText);

        return (
            <React.Fragment>
                <Anchor className="sm-parameter-header" onClick={toggleMachineModalSection}>
                    <span className="fa fa-gear sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Machine Modal')}</span>
                    <span className={classNames(
                        'fa',
                        enabled ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {enabled && (
                    <React.Fragment>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Motion')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.motion || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Coordinate')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.wcs || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Plane')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.plane || none} />
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
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Program')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.program || none} />
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Spindle')}</span>
                            <TextInput className="sm-parameter-row__input-lg" disabled value={modal.spindle || none} />
                        </div>
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }
}

export default MachineModal;
