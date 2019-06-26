import PropTypes from 'prop-types';
import React from 'react';
import RepeatButton from '../../components/RepeatButton';
import TipTrigger from '../../components/TipTrigger';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import DigitalReadout from './DigitalReadout';
import styles from './index.styl';

const Overrides = (props) => {
    const { ovF, ovS, actions } = props;

    if (!ovF && !ovS) {
        return null;
    }

    return (
        <div className={styles.overrides}>
            {!!ovF && (
                <TipTrigger
                    placement="right"
                    title="F"
                    content={i18n._('Adjust feedrate percentage, which applies to moves along all axes.')}
                >
                    <DigitalReadout label="F" value={`${ovF}%`}>
                        <RepeatButton
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('feedOverride', -10);
                            }}
                        >
                            <i className="fa fa-arrow-down" style={{ fontSize: 14 }} />
                            <span style={{ marginLeft: 5 }}>
                            -10%
                            </span>
                        </RepeatButton>
                        <RepeatButton
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('feedOverride', -1);
                            }}
                        >
                            <i className="fa fa-arrow-down" style={{ fontSize: 10 }} />
                            <span style={{ marginLeft: 5 }}>
                            -1%
                            </span>
                        </RepeatButton>
                        <RepeatButton
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('feedOverride', 1);
                            }}
                        >
                            <i className="fa fa-arrow-up" style={{ fontSize: 10 }} />
                            <span style={{ marginLeft: 5 }}>
                            1%
                            </span>
                        </RepeatButton>
                        <RepeatButton
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('feedOverride', 10);
                            }}
                        >
                            <i className="fa fa-arrow-up" style={{ fontSize: 14 }} />
                            <span style={{ marginLeft: 5 }}>
                            10%
                            </span>
                        </RepeatButton>
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('feedOverride', 0);
                            }}
                        >
                            <i className="fa fa-undo fa-fw" />
                        </button>
                    </DigitalReadout>
                </TipTrigger>
            )}
            {!!ovS && actions.is3DPrinting() && (
                <TipTrigger
                    placement="right"
                    title="S"
                    content={i18n._('Adjust flow compensation for the extruder.')}
                >
                    <DigitalReadout label="S" value={`${ovS}%`}>
                        <RepeatButton
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('spindleOverride', -10);
                            }}
                        >
                            <i className="fa fa-arrow-down" style={{ fontSize: 14 }} />
                            <span style={{ marginLeft: 5 }}>-10%</span>
                        </RepeatButton>
                        <RepeatButton
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('spindleOverride', -1);
                            }}
                        >
                            <i className="fa fa-arrow-down" style={{ fontSize: 10 }} />
                            <span style={{ marginLeft: 5 }}>-1%</span>
                        </RepeatButton>
                        <RepeatButton
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('spindleOverride', 1);
                            }}
                        >
                            <i className="fa fa-arrow-up" style={{ fontSize: 10 }} />
                            <span style={{ marginLeft: 5 }}>1%</span>
                        </RepeatButton>
                        <RepeatButton
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('spindleOverride', 10);
                            }}
                        >
                            <i className="fa fa-arrow-up" style={{ fontSize: 14 }} />
                            <span style={{ marginLeft: 5 }}>10%</span>
                        </RepeatButton>
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('spindleOverride', 0);
                            }}
                        >
                            <i className="fa fa-undo fa-fw" />
                        </button>
                    </DigitalReadout>
                </TipTrigger>
            )}
        </div>
    );
};

Overrides.propTypes = {
    ovF: PropTypes.number,
    ovS: PropTypes.number,
    actions: PropTypes.object
};

export default Overrides;
