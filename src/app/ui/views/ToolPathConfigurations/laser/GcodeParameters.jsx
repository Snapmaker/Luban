import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
// import Slider from '../../../components/Slider';
import { ABSENT_VALUE, TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_VECTOR } from '../../../../constants';
import i18n from '../../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import TipTrigger from '../../../components/TipTrigger';
import SvgIcon from '../../../components/SvgIcon';

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

        const { density, fillDensity, jogSpeed, workSpeed, dwellTime, plungeSpeed, multiPassEnabled,
            multiPasses, multiPassDepth, fixedPowerEnabled, fixedPower } = gcodeConfig;

        return (
            <React.Fragment>
                {isImage && (
                    <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                        <SvgIcon
                            name="TitleSetting"
                            size={24}
                        />
                        <span>{i18n._('Fill')}</span>
                    </div>
                )}
                {isImage && (
                    <div>
                        <TipTrigger
                            title={i18n._('Density')}
                            content={i18n._('Determines how fine and smooth the engraved picture will be. \
    The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.')}
                        >
                            <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                                <span>{i18n._('Density')}</span>
                                <Input
                                    className="sm-flex-auto"
                                    size="large"
                                    value={density}
                                    min={1}
                                    max={10}
                                    step={1}
                                    onChange={(value) => { this.props.updateGcodeConfig({ density: value }); }}
                                />
                                <span className="unit-text sm-flex__input-unit-in-modal line-height-32 margin-horizontal-16  color-black-5">dot/mm</span>
                            </div>
                        </TipTrigger>
                    </div>
                )}
                {isSVG && (
                    <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                        <SvgIcon
                            name="TitleSetting"
                            size={24}
                        />
                        <span>{i18n._('Fill')}</span>
                    </div>
                )}
                {isSVG && (
                    <div>
                        <div
                            title={i18n._('Fill')}
                        >
                            <TipTrigger
                                title={i18n._('Fill Density')}
                                content={i18n._('Set the degree to which an area is filled with laser dots. The highest density is 20 dot/mm. When it is set to 0, the SVG image will be engraved without fill.')}
                            >
                                <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                                    <span>{i18n._('Fill Density')}</span>
                                    <Input
                                        className="sm-flex-auto"
                                        size="large"
                                        value={fillDensity}
                                        min={0}
                                        marks={
                                            {
                                                10: ''
                                            }
                                        }
                                        max={20}
                                        onChange={(value) => { this.props.updateGcodeConfig({ fillDensity: value }); }}
                                    />
                                </div>
                            </TipTrigger>
                        </div>
                    </div>
                )}
                <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                    <SvgIcon
                        name="TitleSetting"
                        size={24}
                    />
                    <span>{i18n._('Speed')}</span>
                </div>
                {jogSpeed !== ABSENT_VALUE && (
                    <TipTrigger
                        title={i18n._('Jog Speed')}
                        content={i18n._('Determines how fast the machine moves when it’s not engraving.')}
                    >
                        <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                            <span>{i18n._('Jog Speed')}</span>
                            <Input
                                className="sm-flex-auto"
                                size="large"
                                value={jogSpeed}
                                min={1}
                                max={6000}
                                step={1}
                                onChange={(value) => { this.props.updateGcodeConfig({ jogSpeed: value }); }}
                            />
                            <span className="unit-text sm-flex__input-unit-in-modal line-height-32 margin-horizontal-16 color-black-5">mm/min</span>
                        </div>
                    </TipTrigger>
                )}
                {workSpeed !== ABSENT_VALUE && (
                    <TipTrigger
                        title={i18n._('Work Speed')}
                        content={i18n._('Determines how fast the machine moves when it’s engraving.')}
                    >
                        <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                            <span>{i18n._('Work Speed')}</span>
                            <Input
                                className="sm-flex-auto"
                                size="large"
                                value={workSpeed}
                                min={1}
                                step={1}
                                max={6000}
                                onChange={(value) => { this.props.updateGcodeConfig({ workSpeed: value }); }}
                            />
                            <span className="unit-text sm-flex__input-unit-in-modal line-height-32 margin-horizontal-16 color-black-5">mm/min</span>
                        </div>
                    </TipTrigger>
                )}
                {dwellTime !== ABSENT_VALUE && (
                    <TipTrigger
                        title={i18n._('Dwell Time')}
                        content={i18n._('Determines how long the laser keeps on when it’s engraving a dot.')}
                    >
                        <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                            <span>{i18n._('Dwell Time')}</span>
                            <Input
                                className="sm-flex-auto"
                                size="large"
                                value={dwellTime}
                                min={0.1}
                                max={1000}
                                step={0.1}
                                onChange={(value) => { this.props.updateGcodeConfig({ dwellTime: value }); }}
                            />
                            <span className="unit-text sm-flex__input-unit-in-modal line-height-32 margin-horizontal-16 color-black-5">ms/dot</span>
                        </div>
                    </TipTrigger>
                )}
                {plungeSpeed !== ABSENT_VALUE && (
                    <TipTrigger
                        title={i18n._('Plunge Speed')}
                    >
                        <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                            <span>{i18n._('Plunge Speed')}</span>
                            <Input
                                className="sm-flex-auto"
                                size="large"
                                value={plungeSpeed}
                                min={0.1}
                                max={1000}
                                step={0.1}
                                onChange={(value) => { this.props.updateGcodeConfig({ plungeSpeed: value }); }}
                            />
                            <span className="unit-text sm-flex__input-unit-in-modal line-height-32 margin-horizontal-16 color-black-5">mm/min</span>
                        </div>
                    </TipTrigger>
                )}
                <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                    <SvgIcon
                        name="TitleSetting"
                        size={24}
                    />
                    <span>{i18n._('Repetition')}</span>
                </div>
                {multiPassEnabled !== undefined && (
                    <div
                        style={{ marginTop: '10px', marginBottom: '10px' }}
                        title={i18n._('Multi-pass')}
                        titletip={i18n._('When enabled, the printer will run the G-code multiple times automatically according to the below settings. This feature helps you cut materials that can\'t be cut with only one pass.')}
                    >
                        <TipTrigger
                            title={i18n._('Number of Passes')}
                            content={i18n._('Determines how many times the printer will run the G-code automatically.')}
                        >
                            <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                                <span>{i18n._('Number of Passes')}</span>
                                <Input
                                    className="sm-flex-auto"
                                    size="large"
                                    min={1}
                                    max={50}
                                    value={multiPasses}
                                    onChange={(value) => { this.props.updateGcodeConfig({ multiPasses: value }); }}
                                />
                            </div>
                        </TipTrigger>

                        {multiPasses > 1 && (
                            <TipTrigger
                                title={i18n._('Z step per pass')}
                                content={i18n._('Determines how much the laser module will be lowered after each pass.')}
                            >
                                <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                                    <span>{i18n._('Z step per pass')}</span>
                                    <Input
                                        className="sm-flex-auto"
                                        size="large"
                                        min={0}
                                        max={10}
                                        value={multiPassDepth}
                                        onChange={(value) => { this.props.updateGcodeConfig({ multiPassDepth: value }); }}
                                    />
                                    <span className="unit-text sm-flex__input-unit-in-modal line-height-32 margin-horizontal-16 color-black-5">mm</span>
                                </div>
                            </TipTrigger>
                        )}
                    </div>
                )}
                {fixedPowerEnabled !== undefined && (
                    <div
                        style={{ marginTop: '10px' }}
                        title={i18n._('Fixed Power')}
                        titletip={i18n._('When enabled, the power used to engrave this image will be set in the G-code, so it is not affected by the power you set in Workspace. When engraving multiple images, you can set the power for each image separately.')}
                    >
                        <div className="border-bottom-normal padding-bottom-4 margin-bottom-16">
                            <SvgIcon
                                name="TitleSetting"
                                size={24}
                            />
                            <span>{i18n._('Power')}</span>
                        </div>
                        <TipTrigger
                            title={i18n._('Power')}
                            content={i18n._('Power to use when laser is working.')}
                        >
                            <div className="sm-flex justify-space-between height-32 margin-vertical-8">
                                <span>{i18n._('Power (%)')}</span>
                                <Input
                                    className="sm-flex-auto"
                                    size="large"
                                    min={1}
                                    max={100}
                                    value={fixedPower}
                                    onChange={(value) => { this.props.updateGcodeConfig({ fixedPower: value }); }}
                                />
                                <span className="unit-text sm-flex__input-unit-in-modal line-height-32 margin-horizontal-16 color-black-5">%</span>
                            </div>
                        </TipTrigger>
                    </div>
                )}
            </React.Fragment>
        );
    }
}

export default GcodeParameters;
