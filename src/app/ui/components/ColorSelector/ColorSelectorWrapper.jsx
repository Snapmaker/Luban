import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CustomPicker } from 'react-color';
import Anchor from '../Anchor';
import SvgIcon from '../SvgIcon';
import i18n from '../../../lib/i18n';
import { PRINTING_MATERIAL_CONFIG_COLORS } from '../../../constants';

const ColorSelectorPicker = React.memo(({ onChangeComplete, onClose, value }) => {
    return (
        <div
            className="border-radius-8 border-default-black-5 padding-horizontal-14 padding-vertical-16 box-shadow-default"
        >
            <div className="sm-flex justify-space-between margin-bottom-8">
                <span className="width-auto margin-left-2">{i18n._('key-color_selector-Basic Color')}</span>
                <div className="sm-flex-auto">
                    <SvgIcon
                        name="Cancel"
                        type={['static']}
                        size="24"
                        onClick={onClose}
                    />
                </div>
            </div>
            {PRINTING_MATERIAL_CONFIG_COLORS.map((colorLines) => {
                return (
                    <div
                        className="sm-flex position-re"
                    >
                        {colorLines.map((color) => {
                            return (
                                <Anchor
                                    onClick={() => {
                                        onChangeComplete(color);
                                    }}
                                >
                                    <div
                                        className={classNames('margin-left-2', 'margin-top-2',
                                            'width-32', 'height-32',
                                            'padding-vertical-3', 'padding-horizontal-3',
                                            color === value ? 'border-default-black-2' : null,
                                            color === value ? 'border-radius-8' : null)}
                                    >
                                        <div
                                            className={classNames('border-radius-4', 'width-24', 'height-24',
                                                color === '#ffffff' ? 'border-default-black-5' : null)}
                                            style={{
                                                backgroundColor: color
                                            }}
                                        />
                                    </div>
                                </Anchor>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
});

ColorSelectorPicker.propTypes = {
    onClose: PropTypes.func,
    value: PropTypes.string,
    onChangeComplete: PropTypes.func
};

export default CustomPicker(ColorSelectorPicker);
