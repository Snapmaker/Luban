import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import styles from './styles.styl';

const Jog = (props) => {
    const { jogStep } = props;
    const { jog, changeJogStep } = props;
    const classes = {
        '10': classNames(
            'btn',
            'btn-default',
            { 'btn-select': jogStep === 10 }
        ),
        '1': classNames(
            'btn',
            'btn-default',
            { 'btn-select': jogStep === 1 }
        ),
        '0.5': classNames(
            'btn',
            'btn-default',
            { 'btn-select': jogStep === 0.5 }
        ),
        '0.1': classNames(
            'btn',
            'btn-default',
            { 'btn-select': jogStep === 0.1 }
        )
    };

    return (
        <div className={styles.jogDistanceControl}>
            <div className="input-group input-group-sm" style={{ width: '100%' }}>
                <button
                    type="button"
                    className={classes['10']}
                    style={{ width: '60px', margin: '4px 4px 4px 0' }}
                    title="10 mm"
                    onClick={() => changeJogStep(10)}
                >
                    10
                </button>
                <button
                    type="button"
                    className="btn btn-default"
                    style={{ width: '60px', margin: '4px 80px' }}
                    onClick={() => jog('y+')}
                >
                    Y+
                </button>
                <button
                    type="button"
                    className="btn btn-default"
                    style={{ width: '60px', margin: '4px 0 4px 4px' }}
                    onClick={() => jog('z+')}
                >
                    Z+
                </button>
            </div>
            <div className="input-group input-group-sm" style={{ width: '100%' }}>
                <button
                    type="button"
                    className={classes['1']}
                    style={{ width: '60px', margin: '4px 4px 4px 0' }}
                    title="1 mm"
                    onClick={() => changeJogStep(1)}
                >
                    1
                </button>
                <button
                    type="button"
                    className="btn btn-default"
                    style={{ width: '60px', margin: '4px 30px 4px 20px' }}
                    onClick={() => jog('x-')}
                >
                    X-
                </button>
                <button
                    type="button"
                    className="btn btn-default"
                    style={{ width: '60px', margin: '4px 4px 4px 30px' }}
                    onClick={() => jog('x+')}
                >
                    X+
                </button>
            </div>
            <div className="input-group input-group-sm" style={{ width: '100%' }}>
                <button
                    type="button"
                    className={classes['0.1']}
                    style={{ width: '60px', margin: '4px 4px 4px 0' }}
                    title="0.1 mm"
                    onClick={() => changeJogStep(0.1)}
                >
                    0.1
                </button>
                <button
                    type="button"
                    className="btn btn-default"
                    style={{ width: '60px', margin: '4px 80px' }}
                    onClick={() => jog('y-')}
                >
                    Y-
                </button>
                <button
                    type="button"
                    className="btn btn-default"
                    style={{ width: '60px', margin: '4px 0 4px 4px' }}
                    onClick={() => jog('z-')}
                >
                    Z-
                </button>
            </div>
        </div>
    );
};

Jog.propTypes = {
    jogStep: PropTypes.number.isRequired,
    jog: PropTypes.func.isRequired,
    changeJogStep: PropTypes.func.isRequired
};

export default Jog;
