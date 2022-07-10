import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CustomPicker } from 'react-color';
import Anchor from '../Anchor';
import SvgIcon from '../SvgIcon';
import i18n from '../../../lib/i18n';
import { printingStore } from '../../../store/local-storage';

const ColorSelectorPicker = React.memo(({ onChangeComplete, onClose, colors, value, recentColorKey }) => {
    const recentColors = (printingStore.get(`color-selector-${recentColorKey}`) ?? []);
    for (let i = 0; i < 10; i++) {
        if (recentColors[i] === undefined) {
            recentColors.push('');
        }
    }
    const onChangeColor = (color, resetRecentColors = true) => {
        onChangeComplete(color);

        if (resetRecentColors) {
            let newRecentColors = recentColors;
            const index = newRecentColors.indexOf(color);
            if (index > -1) {
                newRecentColors.splice(index, 1);
            }
            newRecentColors = [color, ...recentColors];
            newRecentColors.splice(10, 1);
            printingStore.set(`color-selector-${recentColorKey}`, newRecentColors);
        }
    };
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
                        size={24}
                        onClick={onClose}
                    />
                </div>
            </div>
            {colors.map((colorLines, index) => {
                const key = `colorLines-${index}`;
                return (
                    <div
                        className="sm-flex position-re"
                        key={key}
                    >
                        {colorLines.map((color) => {
                            return (
                                <Anchor
                                    onClick={() => {
                                        onChangeColor(color, true);
                                    }}
                                    key={color}
                                >
                                    <div
                                        className={classNames(colorLines.indexOf(color) > 0 ? 'margin-left-2' : null,
                                            'margin-top-2',
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
            {recentColorKey && (
                <>
                    <div className="sm-flex justify-space-between margin-top-12 margin-bottom-8">
                        <span className="width-auto margin-left-2">{i18n._('key-color_selector-Recent Color')}</span>
                    </div>
                    <div
                        className="sm-flex position-re"
                    >
                        {recentColors.map((color, index) => {
                            const key = `recentColor-${index}`;
                            if (color === '') {
                                return (
                                    <div
                                        key={key}
                                        className={classNames('margin-left-2', 'margin-top-2', 'width-32', 'height-32',
                                            'padding-vertical-3', 'padding-horizontal-3')}
                                    >
                                        <div
                                            className={classNames('border-radius-4', 'width-24', 'height-24',
                                                'border-dashed-black-5')}
                                        />
                                    </div>
                                );
                            }
                            return (
                                <Anchor
                                    onClick={() => {
                                        onChangeColor(color, false);
                                    }}
                                    key={key}
                                >
                                    <div
                                        className={classNames(recentColors.indexOf(color) > 0 ? 'margin-left-2' : null,
                                            'margin-top-2',
                                            'width-32', 'height-32',
                                            'padding-vertical-3', 'padding-horizontal-3')}
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
                </>
            )}
        </div>
    );
});

ColorSelectorPicker.propTypes = {
    onClose: PropTypes.func,
    colors: PropTypes.array,
    value: PropTypes.string,
    onChangeComplete: PropTypes.func,
    recentColorKey: PropTypes.string
};

export default CustomPicker(ColorSelectorPicker);
