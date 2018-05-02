import _ from 'lodash';
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Validation from '@trendmicro/react-validation';
import Modal from '../../../components/Modal';
import Notifications from '../../../components/Notifications';
import ToggleSwitch from '../../../components/ToggleSwitch';
import i18n from '../../../lib/i18n';
import * as validations from '../../../lib/validations';
import styles from '../form.styl';

class UpdateRecord extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    fields = {
        enabled: null,
        event: null,
        trigger: null,
        commands: null
    };

    get value() {
        return {
            enabled: !!_.get(this.fields.enabled, 'state.checked'),
            event: _.get(this.fields.event, 'state.value'),
            trigger: _.get(this.fields.trigger, 'state.value'),
            commands: _.get(this.fields.commands, 'state.value')
        };
    }
    render() {
        const { state, actions } = this.props;
        const { modal } = state;
        const {
            alertMessage,
            sampleCommands,
            enabled,
            event,
            trigger,
            commands
        } = modal.params;

        return (
            <Modal
                onClose={actions.closeModal}
                size="sm"
            >
                <Modal.Header>
                    <Modal.Title>
                        {i18n._('Events')}
                        <span className="space" />
                        &rsaquo;
                        <span className="space" />
                        {i18n._('Update')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {alertMessage &&
                    <Notifications
                        bsStyle="danger"
                        onDismiss={() => {
                            actions.updateModalParams({ alertMessage: '' });
                        }}
                    >
                        {alertMessage}
                    </Notifications>
                    }
                    <Validation.Form
                        ref={node => {
                            this.form = node;
                        }}
                        onSubmit={(event) => {
                            event.preventDefault();
                        }}
                    >
                        <div className={styles.formFields}>
                            <div className={styles.formGroup}>
                                <label>{i18n._('Enabled')}</label>
                                <div>
                                    <ToggleSwitch
                                        ref={node => {
                                            this.fields.enabled = node;
                                        }}
                                        size="sm"
                                        checked={enabled}
                                    />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>{i18n._('Event')}</label>
                                <Validation.Select
                                    ref={node => {
                                        this.fields.event = node;
                                    }}
                                    name="event"
                                    value={event}
                                    className={classNames(
                                        'form-control',
                                        styles.formControl,
                                        styles.short
                                    )}
                                    validations={[validations.required]}
                                >
                                    <option value="">{i18n._('Choose an event')}</option>
                                    <option value="gcode:load">{i18n._('G-code: Load')}</option>
                                    <option value="gcode:unload">{i18n._('G-code: Unload')}</option>
                                    <option value="gcode:start">{i18n._('G-code: Start')}</option>
                                    <option value="gcode:stop">{i18n._('G-code: Stop')}</option>
                                    <option value="gcode:pause">{i18n._('G-code: Pause')}</option>
                                    <option value="gcode:resume">{i18n._('G-code: Resume')}</option>
                                    <option value="feedhold">{i18n._('Feed Hold')}</option>
                                    <option value="cyclestart">{i18n._('Cycle Start')}</option>
                                    <option value="homing">{i18n._('Homing')}</option>
                                    <option value="sleep">{i18n._('Sleep')}</option>
                                    <option value="macro:run">{i18n._('Run Macro')}</option>
                                    <option value="macro:load">{i18n._('Load Macro')}</option>
                                </Validation.Select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>{i18n._('Trigger')}</label>
                                <Validation.Select
                                    ref={node => {
                                        this.fields.trigger = node;
                                    }}
                                    name="trigger"
                                    value={trigger}
                                    className={classNames(
                                        'form-control',
                                        styles.formControl,
                                        styles.short
                                    )}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        if (value === 'system') {
                                            const sampleCommands = [
                                                'sleep 5',
                                                '/sbin/shutdown'
                                            ].join('\n');
                                            actions.updateModalParams({ sampleCommands: sampleCommands });
                                        } else if (value === 'gcode') {
                                            const sampleCommands = [
                                                'G21  ; Set units to mm',
                                                'G90  ; Absolute positioning',
                                                'G1 Z1 F500  ; Move to clearance level'
                                            ].join('\n');
                                            actions.updateModalParams({ sampleCommands: sampleCommands });
                                        }
                                    }}
                                    validations={[validations.required]}
                                >
                                    <option value="">{i18n._('Choose an trigger')}</option>
                                    <option value="system">{i18n._('System')}</option>
                                    <option value="gcode">{i18n._('G-code')}</option>
                                </Validation.Select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>{i18n._('Commands')}</label>
                                <Validation.Textarea
                                    ref={node => {
                                        this.fields.commands = node;
                                    }}
                                    name="commands"
                                    value={commands}
                                    rows="5"
                                    className={classNames(
                                        'form-control',
                                        styles.formControl,
                                        styles.long
                                    )}
                                    placeholder={sampleCommands}
                                    validations={[validations.required]}
                                />
                            </div>
                        </div>
                    </Validation.Form>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type="button"
                        className="btn btn-default"
                        onClick={actions.closeModal}
                    >
                        {i18n._('Cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            this.form.validateAll();

                            if (Object.keys(this.form.state.errors).length > 0) {
                                return;
                            }

                            const { id } = modal.params;
                            const { enabled, event, trigger, commands } = this.value;
                            const forceReload = true;

                            actions.updateRecord(id, { enabled, event, trigger, commands }, forceReload);
                        }}
                    >
                        {i18n._('OK')}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default UpdateRecord;
