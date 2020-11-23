import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import styles from './index.styl';


const JogPad = React.memo((props) => {
    const { state, actions } = props;
    const { canClick, keypadJogging, selectedAxis, workPosition } = state;

    return (
        <div className={styles['jog-pad']}>
            <div className="mb-2">
                <div className="row no-gutters">
                    <div className={classNames(
                        { [styles['column-5']]: workPosition.isFourAxis },
                        { [styles['column-4']]: !workPosition.isFourAxis },
                    )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-minus jog-y-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: -distance, Y: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move X- Y+')}
                            >
                                <i className={classNames('fa', 'fa-arrow-circle-up', styles['rotate--45deg'])} style={{ fontSize: 16 }} />
                            </button>
                        </div>
                    </div>
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'y' }
                        )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-y-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ Y: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move Y+')}
                            >
                                <span className={styles['jog-text']}>Y+</span>
                            </button>
                        </div>
                    </div>
                    <div className={classNames(
                        { [styles['column-5']]: workPosition.isFourAxis },
                        { [styles['column-4']]: !workPosition.isFourAxis },
                    )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-plus jog-y-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: distance, Y: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move X+ Y+')}
                            >
                                <i className={classNames('fa', 'fa-arrow-circle-up', styles['rotate-45deg'])} style={{ fontSize: 16 }} />
                            </button>
                        </div>
                    </div>
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'z' }
                        )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-z-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ Z: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move Z+')}
                            >
                                <span className={styles['jog-text']}>Z+</span>
                            </button>
                        </div>
                    </div>
                    {workPosition.isFourAxis && (
                        <div
                            className={classNames(
                                { [styles['column-5']]: workPosition.isFourAxis },
                                { [styles['column-4']]: !workPosition.isFourAxis },
                                { [styles['jog-direction-highlight']]: keypadJogging }
                            )}
                        >
                            <div className="mr-3">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary jog-z-plus"
                                    onClick={() => {
                                        const angle = actions.getJogAngle();
                                        actions.jog({ B: angle });
                                    }}
                                    disabled={!canClick}
                                    title={i18n._('Move B+')}
                                >
                                    <span className={styles['jog-text']}>B+</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="mb-2">
                <div className="row no-gutters">
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },

                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'x' }
                        )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move X-')}
                            >
                                <span className={styles['jog-text']}>X-</span>
                            </button>
                        </div>
                    </div>
                    <div className={classNames(
                        { [styles['column-5']]: workPosition.isFourAxis },
                        { [styles['column-4']]: !workPosition.isFourAxis },
                    )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-xy-zero"
                                onClick={() => actions.move({ X: 0, Y: 0 })}
                                disabled={!canClick}
                                title={i18n._('Move To XY Zero (G0 X0 Y0)')}
                            >
                                <span className={styles['jog-text']}>X/Y</span>
                            </button>
                        </div>
                    </div>
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'x' }
                        )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move X+')}
                            >
                                <span className={styles['jog-text']}>X+</span>
                            </button>
                        </div>
                    </div>
                    <div className={classNames(
                        { [styles['column-5']]: workPosition.isFourAxis },
                        { [styles['column-4']]: !workPosition.isFourAxis },
                    )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-z-zero"
                                onClick={() => actions.move({ Z: 0 })}
                                disabled={!canClick}
                                title={i18n._('Move To Z Zero (G0 Z0)')}
                            >
                                <span className={styles['jog-text']}>Z</span>
                            </button>
                        </div>
                    </div>
                    {workPosition.isFourAxis && (
                        <div className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                        )}
                        >
                            <div className="mr-3">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary jog-z-zero"
                                    onClick={() => actions.move({ B: 0 })}
                                    disabled={!canClick}
                                    title={i18n._('Move To B Zero (G0 B0)')}
                                >
                                    <span className={styles['jog-text']}>B</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="mb-2">
                <div className="row no-gutters">
                    <div className={classNames(
                        { [styles['column-5']]: workPosition.isFourAxis },
                        { [styles['column-4']]: !workPosition.isFourAxis },
                    )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-minus jog-y-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: -distance, Y: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move X- Y-')}
                            >
                                <i className={classNames('fa', 'fa-arrow-circle-down', styles['rotate-45deg'])} style={{ fontSize: 16 }} />
                            </button>
                        </div>
                    </div>
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },

                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'y' }
                        )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-y-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ Y: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move Y-')}
                            >
                                <span className={styles['jog-text']}>Y-</span>
                            </button>
                        </div>
                    </div>
                    <div className={classNames(
                        { [styles['column-5']]: workPosition.isFourAxis },
                        { [styles['column-4']]: !workPosition.isFourAxis },
                    )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-plus jog-y-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: distance, Y: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move X+ Y-')}
                            >
                                <i className={classNames('fa', 'fa-arrow-circle-down', styles['rotate--45deg'])} style={{ fontSize: 16 }} />
                            </button>
                        </div>
                    </div>
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'z' }
                        )}
                    >
                        <div className="mr-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-z-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ Z: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('Move Z-')}
                            >
                                <span className={styles['jog-text']}>Z-</span>
                            </button>
                        </div>
                    </div>
                    {workPosition.isFourAxis && (
                        <div
                            className={classNames(
                                { [styles['column-5']]: workPosition.isFourAxis },
                                { [styles['column-4']]: !workPosition.isFourAxis },
                                { [styles['jog-direction-highlight']]: keypadJogging }
                            )}
                        >
                            <div className="mr-3">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary jog-z-minus"
                                    onClick={() => {
                                        const angle = actions.getJogAngle();
                                        actions.jog({ B: -angle });
                                    }}
                                    disabled={!canClick}
                                    title={i18n._('Move B-')}
                                >
                                    <span className={styles['jog-text']}>B-</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

JogPad.propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
};

export default JogPad;
