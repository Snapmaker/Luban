import React, { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styles from './styles.styl';
import Select from '../../components/Select';
import i18n from '../../../lib/i18n';
import { NumberInput as Input, TextAreaInput } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';

const TextParameters = ({ headType, modifyText, disabled }) => {
    const config = useSelector(state => state[headType]?.modelGroup?.getSelectedModel()?.config);
    const fonts = useSelector(state => state?.text?.fonts);
    const fontOptions = fonts.map((font) => ({
        label: `${font.displayName}-${font.style}`,
        value: font.fontFamily,
        style: font.style
    }));
    const { text, 'font-size': fontSize, 'font-family': fontFamily, alignment } = config;
    const [expanded, setExpanded] = useState(true);

    const fileInput = useRef();

    const actions = {
        onToggleExpand: () => {
            setExpanded(!expanded);
        },
        onClickUpload: () => {
            fileInput.current.value = null;
            fileInput.current.click();
        },
        onChangeText: (newText) => {
            modifyText(null, { text: newText.trim() });
        },
        onChangeFont: (option) => {
            // Upload font (TODO: not used?)
            if (option.value === 'AddFonts') {
                actions.onClickUpload();
                return;
            }

            const newFont = option.value;
            modifyText(null, { fontFamily: newFont, style: option.style });
        },
        onChangeSize: (newSize) => {
            modifyText(null, { fontSize: `${newSize}` });
        },
        onChangeAlignment: (newAlignment) => {
            modifyText(null, { alignment: newAlignment });
        }
    };

    return (
        <div className="margin-top-16 margin-bottom-8 border-top-normal">
            <Anchor className="sm-flex height-32 margin-vertical-8" onClick={actions.onToggleExpand}>
                <span className="sm-flex-width heading-3">{i18n._('key-CncLaser/TextSection-Text')}</span>
                <SvgIcon
                    name="DropdownLine"
                    size={24}
                    type={['static']}
                    className={classNames(
                        expanded ? '' : 'rotate180'
                    )}
                />
            </Anchor>
            {expanded && (
                <React.Fragment>
                    <TipTrigger
                        title={i18n._('key-CncLaser/TextSection-Text')}
                        content={i18n._('key-CncLaser/TextSection-Enter the text you want to laser engrave or CNC carve.')}
                    >
                        <div className="sm-flex margin-vertical-8">
                            <TextAreaInput
                                disabled={disabled}
                                className="sm-flex-width"
                                rows="3"
                                value={text}
                                onChange={actions.onChangeText}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key-CncLaser/TextSection-Font')}
                        content={i18n._('key-CncLaser/TextSection-Select the font of the text.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-auto sm-flex-order-negative width-56">{i18n._('key-CncLaser/TextSection-Font')}</span>
                            <Select
                                disabled={disabled}
                                className="sm-flex-width align-r"
                                clearable={false}
                                size="super-large"
                                options={fontOptions}
                                placeholder={i18n._('key-CncLaser/TextSection-Choose font')}
                                value={fontFamily}
                                onChange={actions.onChangeFont}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key-CncLaser/TextSection-Font Size')}
                        content={i18n._('key-CncLaser/TextSection-Select the font size of the text.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-auto sm-flex-order-negative width-64">{i18n._('key-CncLaser/TextSection-Font Size')}</span>
                            <Input
                                suffix="pt"
                                disabled={disabled}
                                max={2000}
                                className="sm-flex-width align-r"
                                value={parseInt(fontSize, 10)}
                                onChange={actions.onChangeSize}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('key-CncLaser/TextSection-Alignment')}
                        content={i18n._('key-CncLaser/TextSection-Align the text in different lines to either the left or right or in the center horizontally.')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('key-CncLaser/TextSection-Alignment')}</span>
                            <span className={styles.textAlignWrap}>
                                <SvgIcon
                                    className={classNames(
                                        styles.textAlignButton,
                                        'padding-horizontal-10',
                                        'border-default-grey-1',
                                        { [styles.active]: alignment === 'left' }
                                    )}
                                    name="AlignmentLeft"
                                    disabled={disabled}
                                    size={26}
                                    type={['hoverNormal', 'pressNoBackground']}
                                    borderRadius={8}
                                    onClick={() => { actions.onChangeAlignment('left'); }}
                                />
                                <SvgIcon
                                    className={classNames(
                                        styles.textAlignButton,
                                        'padding-horizontal-10',
                                        'border-default-grey-1',
                                        { [styles.active]: alignment === 'middle' }
                                    )}
                                    name="AlignmentCenter"
                                    disabled={disabled}
                                    size={26}
                                    borderRadius={8}
                                    type={['hoverNormal', 'pressNoBackground']}
                                    onClick={() => { actions.onChangeAlignment('middle'); }}
                                />
                                <SvgIcon
                                    className={classNames(
                                        styles.textAlignButton,
                                        'padding-horizontal-10',
                                        'border-default-grey-1',
                                        { [styles.active]: alignment === 'right' }
                                    )}
                                    name="AlignmentRight"
                                    disabled={disabled}
                                    size={26}
                                    borderRadius={8}
                                    type={['hoverNormal', 'pressNoBackground']}
                                    onClick={() => { actions.onChangeAlignment('right'); }}
                                />
                            </span>
                        </div>
                    </TipTrigger>


                </React.Fragment>
            )}
        </div>
    );
};

TextParameters.propTypes = {
    headType: PropTypes.string.isRequired,
    disabled: PropTypes.bool,

    modifyText: PropTypes.func.isRequired
};

export default TextParameters;
