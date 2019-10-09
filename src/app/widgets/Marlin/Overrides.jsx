import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import TipTrigger from '../../components/TipTrigger';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
// import DigitalReadout from './DigitalReadout';
import { NumberInput as Input } from '../../components/Input';
import styles from './index.styl';

const Overrides = (props) => {
    const { speedFactor, extruderFactor, state, actions } = props;

    return (
        <div className={styles.overrides}>
            <table className={styles['parameter-table']} style={{ margin: '10px 0' }}>
                <tbody>
                    <tr>
                        <TipTrigger
                            placement="right"
                            title="Speed Factor"
                            content={i18n._('Adjust feedrate percentage, which applies to moves along all axes.')}
                        >
                            <td style={{ width: '100px', padding: '0' }}>
                                <p style={{ width: '100px', margin: '0', padding: '0 6px' }}>{i18n._('Speed Factor')}</p>
                            </td>
                            <td style={{ width: '15%' }}>
                                <div className="input-group input-group-sm" style={{ float: 'right' }}>
                                    {speedFactor}
                                    <span style={{ margin: '0 4px' }}>%</span>
                                </div>
                            </td>
                            <td style={{ width: '40%' }}>
                                <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                    <span style={{ margin: '0 4px' }}>/</span>
                                    <Input
                                        style={{ width: '50px' }}
                                        value={speedFactor}
                                        min={0}
                                        max={500}
                                        onChange={actions.changeSpeedFactor}
                                    />
                                    <span style={{ margin: '0 4px' }}>%</span>
                                </div>
                            </td>
                            <td style={{ width: '20%' }}>
                                <Anchor
                                    className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                    aria-hidden="true"
                                    onClick={() => {
                                        controller.command('speedFactor', state.speedFactor);
                                    }}
                                />
                                <Anchor
                                    className="fa fa-undo fa-fw"
                                    onClick={() => {
                                        controller.command('speedFactor', 100);
                                    }}
                                />
                            </td>
                        </TipTrigger>
                    </tr>
                    <tr>
                        {actions.is3DPrinting() && (
                            <TipTrigger
                                placement="right"
                                title="Extruder Factor"
                                content={i18n._('Adjust flow compensation for the extruder.')}
                            >
                                <td style={{ width: '100px', padding: '0' }}>
                                    <p style={{ width: '100px', margin: '0', padding: '0 6px' }}>{i18n._('Extruder')}</p>
                                </td>
                                <td style={{ width: '15%' }}>
                                    <div className="input-group input-group-sm" style={{ float: 'right' }}>
                                        {extruderFactor}
                                        <span style={{ margin: '0 4px' }}>%</span>
                                    </div>
                                </td>
                                <td style={{ width: '40%' }}>
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <span style={{ margin: '0 4px' }}>/</span>
                                        <Input
                                            style={{ width: '50px' }}
                                            value={extruderFactor}
                                            min={0}
                                            max={500}
                                            onChange={actions.changeExtruderFactor}
                                        />
                                        <span style={{ margin: '0 4px' }}>%</span>
                                    </div>
                                </td>
                                <td style={{ width: '20%' }}>
                                    <Anchor
                                        className={classNames('fa', 'fa-check', styles['fa-btn'])}
                                        aria-hidden="true"
                                        onClick={() => {
                                            controller.command('factor:extruder', state.extruderFactor);
                                        }}
                                    />
                                    <Anchor
                                        className="fa fa-undo fa-fw"
                                        onClick={() => {
                                            controller.command('factor:extruder', 100);
                                        }}
                                    />
                                </td>
                            </TipTrigger>
                        )}
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

Overrides.propTypes = {
    speedFactor: PropTypes.number,
    extruderFactor: PropTypes.number,
    state: PropTypes.object,
    actions: PropTypes.object
};

export default Overrides;
