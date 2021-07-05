import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import i18n from '../../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput as Input } from '../../../components/Input';
import { TOOLPATH_TYPE_VECTOR } from '../../../../constants';
import Select from '../../../components/Select';
import { toHump } from '../../../../../shared/lib/utils';

function SettingItem(props) {
    const { setting, isSVG, settingName, updateToolConfig, updateGcodeConfig } = props;
    if (!setting) {
        return null;
    }
    const defaultValue = setting.default_value;
    const label = setting.label;
    const unit = setting.unit;
    const min = setting.min || -1000;
    const max = setting.max || 6000;
    const content = setting.description || '';
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
        <div key={settingName} className="sm-parameter-row">
            <TipTrigger
                title={i18n._(label)}
                content={i18n._(content)}
            >
                <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                {type === 'bool' && (
                    <input
                        type="checkbox"
                        className="sm-parameter-row__checkbox"
                        checked={defaultValue}
                        onClick={() => {
                            if (setting.isGcodeConfig) {
                                const gcodeOptions = {};
                                gcodeOptions[toHump(settingName)] = !defaultValue;
                                updateGcodeConfig(gcodeOptions);
                            } else {
                                updateToolConfig(toHump(settingName), !defaultValue);
                            }
                        }}
                        // disabled={isToolParams(settingName)}
                    />
                )}
                {type === 'float' && (
                    <Input
                        className="sm-parameter-row__input"
                        value={defaultValue}
                        min={min}
                        max={max}
                        style={{ width: '160px' }}
                        onChange={value => {
                            if (setting.isGcodeConfig) {
                                const gcodeOptions = {};
                                gcodeOptions[toHump(settingName)] = value;
                                updateGcodeConfig(gcodeOptions);
                            } else {
                                updateToolConfig(toHump(settingName), value);
                            }
                        }}
                        disabled={isToolParams(settingName)}
                    />
                )}
                {type === 'enum' && (
                    <Select
                        className="sm-parameter-row__input"
                        clearable={false}
                        searchable={false}
                        name={i18n._(label)}
                        options={optionsArray}
                        value={defaultValue}
                        onChange={(value) => {
                            if (setting.isGcodeConfig) {
                                const gcodeOptions = {};
                                gcodeOptions[toHump(settingName)] = value.value;
                                updateGcodeConfig(gcodeOptions);
                            } else {
                                updateToolConfig(toHump(settingName), value.value);
                            }
                        }}
                        disabled={isToolParams(settingName)}
                    />
                )}
                <span className="sm-parameter-row__input-unit">{unit}</span>
            </TipTrigger>
        </div>
    );
}
SettingItem.propTypes = {
    settingName: PropTypes.string,
    updateToolConfig: PropTypes.func.isRequired,
    updateGcodeConfig: PropTypes.func.isRequired,
    setting: PropTypes.object.isRequired,
    isSVG: PropTypes.bool.isRequired
};


function ToolParameters(props) {
    const { settings, toolPath, updateToolConfig, updateGcodeConfig } = props;
    const type = toolPath?.type;
    const isSVG = type === TOOLPATH_TYPE_VECTOR;

    return (
        <div>
            <React.Fragment>
                {settings && (
                    <div className="sm-parameter-container">
                        {(Object.keys(settings).map(key => {
                            const setting = settings[key];
                            return (
                                <SettingItem
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
    updateGcodeConfig: PropTypes.func.isRequired
};

export default ToolParameters;
