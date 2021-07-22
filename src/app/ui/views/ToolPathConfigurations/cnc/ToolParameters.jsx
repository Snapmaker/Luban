import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import i18n from '../../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput as Input } from '../../../components/Input';
import { TOOLPATH_TYPE_VECTOR } from '../../../../constants';
import Select from '../../../components/Select';
import Checkbox from '../../../components/Checkbox';
import { toHump, toLine } from '../../../../../shared/lib/utils';

function SettingItem(props) {
    const { setting, isSVG, settingName, updateToolConfig, updateGcodeConfig, styleSize = 'large' } = props;
    if (!setting) {
        return null;
    }
    const defaultValue = setting.default_value;
    const label = setting.label;
    const unit = setting.unit;
    const min = setting.min ?? -1000;
    const max = setting.max ?? 6000;
    const content = setting.description ?? '';
    const type = setting.type;

    const isToolParams = (k) => {
        return _.includes(['angle', 'shaft_diameter', 'diameter'], k);
    };

    if (settingName === 'density' && isSVG) {
        return null;
    }

    const options = setting.options;
    const optionsArray = [];
    if (options) {
        Object.keys(options).map(key => {
            return optionsArray.push({
                'label': options[key],
                'value': key
            });
        });
    }

    return (
        <TipTrigger
            title={i18n._(label)}
            content={i18n._(content)}
        >
            <div key={settingName} className="position-re sm-flex justify-space-between height-32 margin-vertical-8">
                <span className="sm-flex-auto sm-flex-order-negative">{i18n._(label)}</span>
                {type === 'bool' && (
                    <Checkbox
                        className="align-r"
                        checked={defaultValue}
                        onChange={(event) => {
                            if (setting.isGcodeConfig) {
                                const gcodeOptions = {};
                                gcodeOptions[toHump(settingName)] = event.target.checked;
                                updateGcodeConfig(gcodeOptions);
                            } else {
                                updateToolConfig(toLine(settingName), event.target.checked);
                            }
                        }}
                    />
                )}
                {type === 'float' && (
                    <Input
                        suffix={unit}
                        value={defaultValue}
                        min={min}
                        max={max}
                        size={styleSize}
                        className="sm-flex-auto"
                        onChange={value => {
                            if (setting.isGcodeConfig) {
                                const gcodeOptions = {};
                                gcodeOptions[toHump(settingName)] = value;
                                updateGcodeConfig(gcodeOptions);
                            } else {
                                updateToolConfig(toLine(settingName), value);
                            }
                        }}
                        disabled={isToolParams(settingName)}
                    />
                )}
                {type === 'enum' && (
                    <Select
                        clearable={false}
                        searchable={false}
                        name={i18n._(label)}
                        size={styleSize === 'middle' ? 'small' : 'middle'} // Todo: change the size to the same value
                        className="sm-flex-width align-r"
                        options={optionsArray}
                        value={defaultValue && defaultValue.toString()}
                        onChange={(value) => {
                            if (setting.isGcodeConfig) {
                                const gcodeOptions = {};
                                gcodeOptions[toHump(settingName)] = value.value;
                                updateGcodeConfig(gcodeOptions);
                            } else {
                                updateToolConfig(toLine(settingName), value.value);
                            }
                        }}
                        disabled={isToolParams(settingName)}
                    />
                )}
            </div>
        </TipTrigger>

    );
}
SettingItem.propTypes = {
    settingName: PropTypes.string,
    updateToolConfig: PropTypes.func.isRequired,
    updateGcodeConfig: PropTypes.func.isRequired,
    setting: PropTypes.object.isRequired,
    isSVG: PropTypes.bool.isRequired,
    styleSize: PropTypes.string.isRequired
};


function ToolParameters(props) {
    const { settings, toolPath, updateToolConfig, updateGcodeConfig, styleSize = 'large' } = props;
    const type = toolPath?.type;
    const isSVG = type === TOOLPATH_TYPE_VECTOR;

    return (
        <div>
            <React.Fragment>
                {settings && (
                    <div>
                        {(Object.keys(settings).map(key => {
                            const setting = settings[key];
                            return (
                                <SettingItem
                                    styleSize={styleSize}
                                    setting={setting}
                                    updateToolConfig={updateToolConfig}
                                    updateGcodeConfig={updateGcodeConfig}
                                    key={key}
                                    settingName={key}
                                    isSVG={isSVG}
                                />
                            );
                        }))}
                    </div>
                )}
            </React.Fragment>
        </div>
    );
}
ToolParameters.propTypes = {
    settings: PropTypes.object.isRequired,
    toolPath: PropTypes.object.isRequired,
    updateToolConfig: PropTypes.func.isRequired,
    updateGcodeConfig: PropTypes.func.isRequired,
    styleSize: PropTypes.string
};

export default ToolParameters;
