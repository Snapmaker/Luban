// import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import styles from './index.styl';
import {
    FILTER_SPEED_FAST,
    FILTER_SPEED_MEDIUM,
    FILTER_SPEED_LOW
} from '../../constants';
import i18n from '../../lib/i18n';

class Filter extends PureComponent {
    static propTypes = {
        // redux
    };

    state = {
        isFilterEnable: true,
        workSpeed: FILTER_SPEED_FAST,
        filterLife: 0
    };

    actions = {
        onHandleFilterEnabled: () => {
            this.setState({
                isFilterEnable: !this.state.isFilterEnable
            });
        },
        onChangeFilterSpeed: (workSpeed) => {
            // todo remove this test
            let speed;
            if (workSpeed === FILTER_SPEED_FAST) {
                speed = 2;
            }
            if (workSpeed === FILTER_SPEED_MEDIUM) {
                speed = 1;
            }
            if (workSpeed === FILTER_SPEED_LOW) {
                speed = 0;
            }

            //test
            this.setState({
                workSpeed: workSpeed,
                filterLife: speed // todo remove it
            });
        }
    };


    render() {
        const { isFilterEnable, workSpeed, filterLife } = this.state;
        return (
            <div>
                <div className="sm-parameter-container">
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Filter')}</span>
                        <button
                            type="button"
                            className={classNames(
                                'sm-btn-small',
                                isFilterEnable ? 'sm-btn-primary' : 'sm-btn-danger'
                            )}
                            style={{
                                float: 'right'
                            }}
                            onClick={this.actions.onHandleFilterEnabled}
                        >
                            {!isFilterEnable && <i className="fa fa-toggle-off" />}
                            {!!isFilterEnable && <i className="fa fa-toggle-on" />}
                            <span className="space" />
                            {isFilterEnable ? i18n._('On') : i18n._('Off')}
                        </button>
                    </div>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('Work Speed')}</span>
                        <span
                            className={classNames(
                                styles['btn-3btns']
                            )}
                        >
                            <button
                                disabled={!isFilterEnable}
                                type="button"
                                className={classNames(
                                    (workSpeed === FILTER_SPEED_LOW) ? styles.active : styles.passive,
                                    (!isFilterEnable) ? styles.disabled : null
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_LOW)}
                            >
                                {i18n._('Low')}
                            </button>
                            <button
                                disabled={!isFilterEnable}
                                type="button"
                                className={classNames(
                                    (workSpeed === FILTER_SPEED_MEDIUM) ? styles.active : styles.passive,
                                    (!isFilterEnable) ? styles.disabled : null
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_MEDIUM)}
                            >
                                {i18n._('Medium')}
                            </button>
                            <button
                                disabled={!isFilterEnable}
                                type="button"
                                className={classNames(
                                    (workSpeed === FILTER_SPEED_FAST) ? styles.active : styles.passive,
                                    (!isFilterEnable) ? styles.disabled : null
                                )}
                                onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_FAST)}
                            >
                                {i18n._('Fast')}
                            </button>
                        </span>
                    </div>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('Filter Life')}</span>
                        <span
                            className={classNames(
                                styles.lifeLength
                            )}
                        >
                            <span
                                className={classNames(
                                    'space',
                                    filterLife >= 0 ? styles.active : styles.passive
                                )}
                            />
                            <span
                                className={classNames(
                                    'space',
                                    filterLife >= 1 ? styles.active : styles.passive
                                )}
                            />
                            <span
                                className={classNames(
                                    'space',
                                    filterLife >= 2 ? styles.active : styles.passive
                                )}
                            />
                        </span>
                    </div>
                    {(filterLife === 0) && (
                        <div className={classNames(styles.notice)}>
                            {i18n._('The filter element needs to be replaced.')}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { workflowState, workflowStatus, isConnected } = state.machine;

    return {
        isConnected,
        workflowState,
        workflowStatus
    };
};

const mapDispatchToProps = () => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Filter);
