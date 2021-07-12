import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import i18n from '../../../../lib/i18n';
import TipTrigger from '../../../components/TipTrigger';
import { NumberInput as Input } from '../../../components/Input';
import { TOOLPATH_TYPE_VECTOR } from '../../../../constants';
import Select from '../../../components/Select';
import Checkbox from '../../../components/Checkbox';
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
        <TipTrigger
            title={i18n._(label)}
            content={i18n._(content)}
        >
            <div key={settingName} className="sm-flex height-32 margin-vertical-8 justify-space-between">
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
                                updateToolConfig(toHump(settingName), event.target.checked);
                            }
                        }}
                    />
                )}
                {type === 'float' && (
                    <Input
                        value={defaultValue}
                        min={min}
                        max={max}
                        className="sm-flex-width align-r"
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
                        clearable={false}
                        searchable={false}
                        name={i18n._(label)}
                        size="small"
                        className="sm-flex-width align-r"
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
                <span className="sm-flex__input-unit-40">{unit}</span>
            </div>
        </TipTrigger>

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
                    <div>
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
