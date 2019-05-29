import get from 'lodash/get';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../lib/i18n';
import Overrides from './Overrides';
import Anchor from '../../components/Anchor';
import styles from '../styles.styl';

class CNC extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { state, actions } = this.props;
        const { statusPadEnabled, overridesEnabled } = state;
        const controllerState = state.controller.state;
        const headStatus = controllerState.headStatus;
        const ovF = get(controllerState, 'ovF', 0);
        const ovS = get(controllerState, 'ovS', 0);

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={actions.onStatusPadEnabled}>
                    <span className="fa fa-gears sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Status Pad')}</span>
                    <span className={classNames(
                        'fa',
                        statusPadEnabled ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {statusPadEnabled && (
                    <table className={styles['parameter-table']} style={{ margin: '10px 0' }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '50%', padding: '0 6px' }}>
                                    <div>{i18n._('Jog Speed')} (G0)</div>
                                    <div>{controllerState.jogSpeed}</div>
                                </td>
                                <td style={{ width: '50%', padding: '0 6px' }}>
                                    <div>{i18n._('Work Speed')} (G1)</div>
                                    <div>{controllerState.workSpeed}</div>
                                </td>
                            </tr>
                            <tr>
                                <td style={{ width: '50%', padding: '0 6px' }}>
                                    <div>{i18n._('Tool Head (M3)')}</div>
                                    <div>
                                        {headStatus === 'on' && (
                                            <button
                                                type="button"
                                                style={{ width: '80px' }}
                                                className="sm-btn-small sm-btn-primary"
                                                onClick={actions.toggleToolHead}
                                            >
                                                <i className="fa fa-toggle-on fa-fw" />
                                                <span className="space space-sm" />
                                                {i18n._('ON')}
                                            </button>
                                        )}
                                        {headStatus === 'off' && (
                                            <button
                                                type="button"
                                                style={{ width: '80px' }}
                                                className="sm-btn-small sm-btn-default"
                                                onClick={actions.toggleToolHead}
                                            >
                                                <i className="fa fa-toggle-off fa-fw" />
                                                <span className="space space-sm" />
                                                {i18n._('OFF')}
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
                <Anchor className="sm-parameter-header" onClick={actions.onOverridesEnabled}>
                    <span className="fa fa-gears sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Overrides')}</span>
                    <span className={classNames(
                        'fa',
                        overridesEnabled ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {overridesEnabled && (
                    <Overrides
                        ovF={ovF}
                        ovS={ovS}
                        actions={actions}
                    />
                )}
            </div>
        );
    }
}

export default CNC;
