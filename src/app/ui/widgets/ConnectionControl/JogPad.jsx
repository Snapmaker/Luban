import { Col, Row } from 'antd';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';
import styles from './styles.styl';

const JogPad = React.memo((props) => {
    const { state, actions, workPosition } = props;
    const { canClick, keypadJogging, selectedAxis } = state;

    return (
        <div className={styles['jog-pad']}>
            <div className="margin-bottom-8">
                <Row>
                    <Col
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                        )}
                    >
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-minus jog-y-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: -distance, Y: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move X- Y+')}
                            >
                                <SvgIcon
                                    borderRadius={8}
                                    name="TopLeft"
                                />
                            </button>
                        </div>
                    </Col>
                    <Col
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'y' }
                        )}
                    >
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-y-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ Y: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move Y+')}
                            >
                                <span className={styles['jog-text']}>Y+</span>
                            </button>
                        </div>
                    </Col>
                    <Col
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                        )}
                    >
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-plus jog-y-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: distance, Y: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move X+ Y+')}
                            >
                                <SvgIcon
                                    borderRadius={8}
                                    name="TopRight"
                                />
                            </button>
                        </div>
                    </Col>
                    <Col
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'z' }
                        )}
                    >
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-z-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ Z: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move Z+')}
                            >
                                <span className={styles['jog-text']}>Z+</span>
                            </button>
                        </div>
                    </Col>
                    {workPosition.isFourAxis && (
                        <Col
                            className={classNames(
                                { [styles['column-5']]: workPosition.isFourAxis },
                                { [styles['column-4']]: !workPosition.isFourAxis },
                                { [styles['jog-direction-highlight']]: keypadJogging }
                            )}
                        >
                            <div className="margin-right-4">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary jog-z-plus"
                                    onClick={() => {
                                        const angle = actions.getJogAngle();
                                        actions.jog({ B: angle });
                                    }}
                                    disabled={!canClick}
                                    title={i18n._('key-Workspace/Control/JogPad-Move B+')}
                                >
                                    <span className={styles['jog-text']}>B+</span>
                                </button>
                            </div>
                        </Col>
                    )}
                </Row>
            </div>
            <div className="margin-bottom-8">
                <Row>
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },

                            { [styles['jog-direction-highlight']]: keypadJogging || selectedAxis === 'x' }
                        )}
                    >
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move X-')}
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
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-xy-zero"
                                onClick={() => actions.move({ X: 0, Y: 0 })}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move To XY Zero (G0 X0 Y0)')}
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
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-plus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move X+')}
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
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-z-zero"
                                onClick={() => actions.move({ Z: 0 })}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move To Z Zero (G0 Z0)')}
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
                            <div className="margin-right-4">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary jog-z-zero"
                                    onClick={() => actions.move({ B: 0 })}
                                    disabled={!canClick}
                                    title={i18n._('key-Workspace/Control/JogPad-Move To B Zero (G0 B0)')}
                                >
                                    <span className={styles['jog-text']}>B</span>
                                </button>
                            </div>
                        </div>
                    )}
                </Row>
            </div>
            <div className="margin-bottom-8">
                <Row>
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                        )}
                    >
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-minus jog-y-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: -distance, Y: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move X- Y-')}
                            >
                                <SvgIcon
                                    borderRadius={8}
                                    name="BottomLeft"
                                />
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
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-y-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ Y: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move Y-')}
                            >
                                <span className={styles['jog-text']}>Y-</span>
                            </button>
                        </div>
                    </div>
                    <div
                        className={classNames(
                            { [styles['column-5']]: workPosition.isFourAxis },
                            { [styles['column-4']]: !workPosition.isFourAxis },
                        )}
                    >
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-x-plus jog-y-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ X: distance, Y: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move X+ Y-')}
                            >
                                <SvgIcon
                                    borderRadius={8}
                                    name="BottomRight"
                                />
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
                        <div className="margin-right-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary jog-z-minus"
                                onClick={() => {
                                    const distance = actions.getJogDistance();
                                    actions.jog({ Z: -distance });
                                }}
                                disabled={!canClick}
                                title={i18n._('key-Workspace/Control/JogPad-Move Z-')}
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
                            <div className="margin-right-4">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary jog-z-minus"
                                    onClick={() => {
                                        const angle = actions.getJogAngle();
                                        actions.jog({ B: -angle });
                                    }}
                                    disabled={!canClick}
                                    title={i18n._('key-Workspace/Control/JogPad-Move B-')}
                                >
                                    <span className={styles['jog-text']}>B-</span>
                                </button>
                            </div>
                        </div>
                    )}
                </Row>
            </div>
        </div>
    );
});

JogPad.propTypes = {
    workPosition: PropTypes.object,
    state: PropTypes.object,
    actions: PropTypes.object
};

export default JogPad;
