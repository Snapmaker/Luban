import _ from 'lodash';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import RepeatButton from '../../components/RepeatButton';
import styles from './styles.styl';

const MaterialThickness = (props) => {
    const { selectedThickness, customThickness, actions } = props;
    const isCustomThicknessSelected = !(_.includes([1, 2, 3, 5], selectedThickness));
    const classes = {
        '1': classNames(
            'btn',
            'btn-default',
            { 'btn-select': selectedThickness === 1 }
        ),
        '2': classNames(
            'btn',
            'btn-default',
            { 'btn-select': selectedThickness === 2 }
        ),
        '3': classNames(
            'btn',
            'btn-default',
            { 'btn-select': selectedThickness === 3 }
        ),
        '5': classNames(
            'btn',
            'btn-default',
            { 'btn-select': selectedThickness === 5 }
        ),
        'custom': classNames(
            'btn',
            'btn-default',
            { 'btn-select': isCustomThicknessSelected }
        )
    };

    return (
        <div className={styles.jogDistanceControl}>
            <div className="input-group input-group-sm">
                <div className="input-group-btn">
                    <button
                        type="button"
                        className={classes['1']}
                        title="1 mm"
                        onClick={() => actions.selectThickness(1)}
                    >
                        1
                    </button>
                    <button
                        type="button"
                        className={classes['2']}
                        title="2 mm"
                        onClick={() => actions.selectThickness(2)}
                    >
                        2
                    </button>
                    <button
                        type="button"
                        className={classes['3']}
                        title="3 mm"
                        onClick={() => actions.selectThickness(3)}
                    >
                       3
                    </button>
                    <button
                        type="button"
                        className={classes['5']}
                        title="5 mm"
                        onClick={() => actions.selectThickness(5)}
                    >
                        5
                    </button>
                    <button
                        type="button"
                        className={classes.custom}
                        title={i18n._('User Defined')}
                        onClick={() => actions.selectThickness()}
                    >
                        <i className="fa fa-adjust" />
                    </button>
                </div>
                <input
                    type="number"
                    className="form-control"
                    style={{ width: '144px', borderRadius: 0 }}
                    min={0}
                    max={100}
                    step={1}
                    value={customThickness}
                    onChange={(event) => {
                        const value = event.target.value;
                        actions.changeCustomThickness(value);
                    }}
                    title={i18n._('Custom thickness')}
                />
                <div className="input-group-btn">
                    <RepeatButton
                        className="btn btn-default"
                        onClick={actions.increaseCustomThickness}
                        title={i18n._('Increase custom thickness by one unit')}
                    >
                        <i className="fa fa-plus" />
                    </RepeatButton>
                    <RepeatButton
                        className="btn btn-default"
                        onClick={actions.decreaseCustomThickness}
                        title={i18n._('Decrease custom thickness by one unit')}
                    >
                        <i className="fa fa-minus" />
                    </RepeatButton>
                </div>
            </div>
        </div>
    );
};

MaterialThickness.propTypes = {
    selectedThickness: PropTypes.number.isRequired,
    customThickness: PropTypes.number.isRequired,
    actions: PropTypes.object
};

export default MaterialThickness;
