import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import { ABSENT_VALUE, TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_VECTOR } from '../../../constants';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import OptionalDropdown from '../../../components/OptionalDropdown';
import NumberInput from '../../../components/Input/NumberInput';

class GcodeParameters extends PureComponent {
    static propTypes = {
        toolPath: PropTypes.object.isRequired,

        updateGcodeConfig: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {
    };

    render() {
        const { toolPath } = this.props;

        const { type, gcodeConfig } = toolPath;

        const isSVG = type === TOOLPATH_TYPE_VECTOR;
        const isImage = type === TOOLPATH_TYPE_IMAGE;

        const { density, optimizePath, fillEnabled, fillDensity, jogSpeed, workSpeed, dwellTime, plungeSpeed, multiPassEnabled,
            multiPasses, multiPassDepth, fixedPowerEnabled, fixedPower } = gcodeConfig;

        return (
            <React.Fragment>

                {isImage && (
                    <TipTrigger
                        title={i18n._('Density')}
                        content={i18n._('Determines how fine and smooth the engraved picture will be. \
The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Density')}</span>
                            <NumberInput
                                className="sm-parameter-row__input"
                                style={{ width: '160px' }}
                                value={density}
                                min={1}
                                max={10}
                                step={1}
                                onChange={(value) => { this.props.updateGcodeConfig({ density: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">dot/mm</span>
                        </div>
                    </TipTrigger>
                )}
                {isSVG && (
                    <div>
                        <TipTrigger
                            title={i18n._('Optimize Path')}
                            content={i18n._('Optimizes the path based on the proximity of the lines in the image.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Optimize Path')}</span>
                                <input
                                    type="checkbox"
                                    className="sm-parameter-row__checkbox"
                                    checked={optimizePath}
                                    onChange={() => { this.props.updateGcodeConfig({ optimizePath: !optimizePath }); }}
                                />
                            </div>
                        </TipTrigger>
                        <OptionalDropdown
                            style={{ marginBottom: '10px' }}
                            title={i18n._('Fill')}
                            onClick={() => { this.props.updateGcodeConfig({ fillEnabled: !fillEnabled }); }}
                            hidden={!fillEnabled}
                        >
                            <TipTrigger
                                title={i18n._('Fill Density')}
                                content={i18n._('Set the degree to which an area is filled with laser dots. The highest density is 20 dot/mm. When it is set to 0, the SVG image will be engraved without fill.')}
                            >
                                <div className="sm-parameter-row">
                                    <span className="sm-parameter-row__label">{i18n._('Fill Density')}</span>
                                    <Input
                                        className="sm-parameter-row__slider-input"
                                        value={fillDensity}
                                        min={0}
                                        max={20}
                                        onChange={(value) => { this.props.updateGcodeConfig({ fillDensity: value }); }}
                                    />
                                    <Slider
                                        className="sm-parameter-row__slider"
                                        value={fillDensity}
                                        min={0}
                                        max={20}
                                        onChange={(value) => { this.props.updateGcodeConfig({ fillDensity: value }); }}
                                    />
                                </div>
                            </TipTrigger>
                        </OptionalDropdown>
                    </div>
                )}

                {jogSpeed !== ABSENT_VALUE && (
                    <TipTrigger
                        title={i18n._('Jog Speed')}
                        content={i18n._('Determines how fast the machine moves when it’s not engraving.')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Jog Speed')}</span>
                            <Input
                                className="sm-parameter-row__input"
                                style={{ width: '160px' }}
                                value={jogSpeed}
                                min={1}
                                max={6000}
                                step={1}
                                onChange={(value) => { this.props.updateGcodeConfig({ jogSpeed: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm/min</span>
                        </div>
                    </TipTrigger>
                )}
                {workSpeed !== ABSENT_VALUE && (
                    <TipTrigger
                        title={i18n._('Work Speed')}
                        content={i18n._('Determines how fast the machine moves when it’s engraving.')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Work Speed')}</span>
                            <Input
                                className="sm-parameter-row__input"
                                style={{ width: '160px' }}
                                value={workSpeed}
                                min={1}
                                step={1}
                                max={6000}
                                onChange={(value) => { this.props.updateGcodeConfig({ workSpeed: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm/min</span>
                        </div>
                    </TipTrigger>
                )}
                {dwellTime !== ABSENT_VALUE && (
                    <TipTrigger
                        title={i18n._('Dwell Time')}
                        content={i18n._('Determines how long the laser keeps on when it’s engraving a dot.')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Dwell Time')}</span>
                            <Input
                                className="sm-parameter-row__input"
                                style={{ width: '160px' }}
                                value={dwellTime}
                                min={0.1}
                                max={1000}
                                step={0.1}
                                onChange={(value) => { this.props.updateGcodeConfig({ dwellTime: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">ms/dot</span>
                        </div>
                    </TipTrigger>
                )}
                {plungeSpeed !== ABSENT_VALUE && (
                    <TipTrigger
                        title={i18n._('Plunge Speed')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Plunge Speed')}</span>
                            <Input
                                className="sm-parameter-row__input"
                                style={{ width: '160px' }}
                                value={plungeSpeed}
                                min={0.1}
                                max={1000}
                                step={0.1}
                                onChange={(value) => { this.props.updateGcodeConfig({ plungeSpeed: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm/min</span>
                        </div>
                    </TipTrigger>
                )}
                {multiPassEnabled !== undefined && (
                    <OptionalDropdown
                        style={{ marginTop: '10px', marginBottom: '10px' }}
                        title={i18n._('Multi-pass')}
                        titleTip={i18n._('When enabled, the printer will run the G-code multiple times automatically according to the below settings. This feature helps you cut materials that can\'t be cut with only one pass.')}
                        onClick={() => { this.props.updateGcodeConfig({ multiPassEnabled: !multiPassEnabled }); }}
                        hidden={!multiPassEnabled}
                    >

                        <TipTrigger
                            title={i18n._('Passes')}
                            content={i18n._('Determines how many times the printer will run the G-code automatically.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Passes')}</span>
                                <Input
                                    className="sm-parameter-row__input"
                                    style={{ width: '160px' }}
                                    min={2}
                                    max={50}
                                    value={multiPasses}
                                    onChange={(value) => { this.props.updateGcodeConfig({ multiPasses: value }); }}
                                />
                            </div>
                        </TipTrigger>

                        <TipTrigger
                            title={i18n._('Pass Depth')}
                            content={i18n._('Determines how much the laser module will be lowered after each pass.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Pass Depth')}</span>
                                <Input
                                    className="sm-parameter-row__input"
                                    style={{ width: '160px' }}
                                    min={0}
                                    max={10}
                                    value={multiPassDepth}
                                    onChange={(value) => { this.props.updateGcodeConfig({ multiPassDepth: value }); }}
                                />
                                <span className="sm-parameter-row__input-unit">mm</span>
                            </div>
                        </TipTrigger>
                    </OptionalDropdown>
                )}
                {fixedPowerEnabled !== undefined && (
                    <OptionalDropdown
                        style={{ marginTop: '10px' }}
                        title={i18n._('Fixed Power')}
                        titleTip={i18n._('When enabled, the power used to engrave this image will be set in the G-code, so it is not affected by the power you set in Workspace. When engraving multiple images, you can set the power for each image separately.')}
                        onClick={() => { this.props.updateGcodeConfig({ fixedPowerEnabled: !fixedPowerEnabled }); }}
                        hidden={!fixedPowerEnabled}
                    >
                        <TipTrigger
                            title={i18n._('Power')}
                            content={i18n._('Power to use when laser is working.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Power (%)')}</span>
                                <Input
                                    className="sm-parameter-row__slider-input"
                                    min={1}
                                    max={100}
                                    value={fixedPower}
                                    onChange={(value) => { this.props.updateGcodeConfig({ fixedPower: value }); }}
                                />
                                <Slider
                                    className="sm-parameter-row__slider"
                                    value={fixedPower}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    onChange={(value) => { this.props.updateGcodeConfig({ fixedPower: value }); }}
                                />
                            </div>
                        </TipTrigger>

                    </OptionalDropdown>
                )}
            </React.Fragment>
        );
    }
}

export default GcodeParameters;
