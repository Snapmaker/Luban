import PropTypes from 'prop-types';
import React from 'react';
import Slider from 'rc-slider';
import TipTrigger from '../../components/TipTrigger';
import i18n from '../../lib/i18n';
import controller from '../../lib/controller';
import DigitalReadout from './DigitalReadout';
import { NumberInput as Input } from '../../components/Input';
import styles from './index.styl';

const Overrides = (props) => {
    const { speedFactor, extruderFactor, actions } = props;
    console.log('ss ', speedFactor, extruderFactor);

    return (
        <div className={styles.overrides}>
            {!!speedFactor && (
                <TipTrigger
                    placement="right"
                    title="F"
                    content={i18n._('Adjust feedrate percentage, which applies to moves along all axes.')}
                >
                    <DigitalReadout label="F" value={`${speedFactor}%`}>
                        <Input
                            style={{ width: '50px' }}
                            value={speedFactor}
                            min={0}
                            max={300}
                            onChange={(value) => {
                                console.log('vv', value);
                                controller.command('speedFactor', value);
                            }}
                        />
                        <Slider
                            className="sm-parameter-row__slider"
                            value={speedFactor}
                            min={0}
                            max={300}
                            onAfterChange={(value) => {
                                console.log('vva', value);
                                controller.command('speedFactor', value);
                            }}
                        />
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('speedFactor', 0);
                            }}
                        >
                            <i className="fa fa-undo fa-fw" />
                        </button>
                    </DigitalReadout>
                </TipTrigger>
            )}
            {!!extruderFactor && actions.is3DPrinting() && (
                <TipTrigger
                    placement="right"
                    title="S"
                    content={i18n._('Adjust flow compensation for the extruder.')}
                >
                    <DigitalReadout label="S" value={`${extruderFactor}%`}>
                        <Input
                            style={{ width: '50px' }}
                            value={extruderFactor}
                            min={0}
                            max={300}
                            onChange={(value) => {
                                controller.command('extruderFactor', value);
                            }}
                        />
                        <Slider
                            className="sm-parameter-row__slider"
                            value={extruderFactor}
                            min={0}
                            max={300}
                            onAfterChange={(value) => {
                                console.log('vvae', value);
                                controller.command('extruderFactor', value);
                            }}
                        />
                        <button
                            type="button"
                            className="btn btn-default"
                            style={{ padding: 5 }}
                            onClick={() => {
                                controller.command('extruderFactor', 0);
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
    speedFactor: PropTypes.number,
    extruderFactor: PropTypes.number,
    actions: PropTypes.object
};

export default Overrides;
