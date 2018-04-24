import _ from 'lodash';
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import RepeatButton from '../../components/RepeatButton';
import {
    DISTANCE_MIN,
    DISTANCE_MAX,
    DISTANCE_STEP
} from './constants';
import styles from './index.styl';

class JogDistance extends PureComponent {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    render() {
        const { state, actions } = this.props;
        const { units, selectedDistance, customDistance } = state;
        const distance = String(selectedDistance); // force convert to string
        const isCustomDistanceSelected = !(_.includes(['10', '1', '0.1', '0.05'], distance));
        const classes = {
            '10': classNames(
                'btn',
                'btn-default',
                { 'btn-select': distance === '10' }
            ),
            '1': classNames(
                'btn',
                'btn-default',
                { 'btn-select': distance === '1' }
            ),
            '0.1': classNames(
                'btn',
                'btn-default',
                { 'btn-select': distance === '0.1' }
            ),
            '0.05': classNames(
                'btn',
                'btn-default',
                { 'btn-select': distance === '0.05' }
            ),
            'custom': classNames(
                'btn',
                'btn-default',
                { 'btn-select': isCustomDistanceSelected }
            )
        };

        return (
            <div className={styles.jogDistanceControl}>
                <div className="input-group input-group-sm">
                    <div className="input-group-btn">
                        <button
                            type="button"
                            className={classes['10']}
                            title={'10 ' + units}
                            onClick={() => actions.selectDistance('10')}
                        >
                            10
                        </button>
                        <button
                            type="button"
                            className={classes['1']}
                            title={'1 ' + units}
                            onClick={() => actions.selectDistance('1')}
                        >
                            1
                        </button>
                        <button
                            type="button"
                            className={classes['0.1']}
                            title={'0.1 ' + units}
                            onClick={() => actions.selectDistance('0.1')}
                        >
                            0.1
                        </button>
                        <button
                            type="button"
                            className={classes['0.05']}
                            title={'0.05 ' + units}
                            onClick={() => actions.selectDistance('0.05')}
                        >
                            0.05
                        </button>
                        <button
                            type="button"
                            className={classes.custom}
                            title={i18n._('User Defined')}
                            onClick={() => actions.selectDistance()}
                        >
                            <i className="fa fa-adjust" />
                        </button>
                    </div>
                    <input
                        type="number"
                        className="form-control"
                        style={{ borderRadius: 0 }}
                        min={DISTANCE_MIN}
                        max={DISTANCE_MAX}
                        step={DISTANCE_STEP}
                        value={customDistance}
                        onChange={(event) => {
                            const customDistance = event.target.value;
                            actions.changeCustomDistance(customDistance);
                        }}
                        title={i18n._('Custom distance for every move operation')}
                    />
                    <div className="input-group-btn">
                        <RepeatButton
                            className="btn btn-default"
                            onClick={(event) => {
                                actions.increaseCustomDistance();
                            }}
                            title={i18n._('Increase custom distance by one unit')}
                        >
                            <i className="fa fa-plus" />
                        </RepeatButton>
                        <RepeatButton
                            className="btn btn-default"
                            onClick={(event) => {
                                actions.decreaseCustomDistance();
                            }}
                            title={i18n._('Decrease custom distance by one unit')}
                        >
                            <i className="fa fa-minus" />
                        </RepeatButton>
                    </div>
                </div>
            </div>
        );
    }
}

export default JogDistance;
