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
        label: font.displayName,
        value: font.fontFamily
    }));
    const { text, 'font-size': fontSize, 'font-family': fontFamily, alignment } = config;
    const [expanded, setExpanded] = useState(true);

    const fileInput = useRef();
    const textArea = useRef();

    const actions = {
        onToggleExpand: () => {
            setExpanded(!expanded);
        },
        onClickUpload: () => {
            fileInput.current.value = null;
            fileInput.current.click();
        },
        onSelectAllText: () => {},
        onChangeText: (event) => {
            const newText = event.target.value;
            modifyText(null, { text: newText });
        },
        onChangeFont: (option) => {
            // Upload font (TODO: not used?)
            if (option.value === 'AddFonts') {
                actions.onClickUpload();
                return;
            }

            const newFont = option.value;
            modifyText(null, { fontFamily: newFont });
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
                <span className="sm-flex-width heading-3">{i18n._('Text')}</span>
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
                        title={i18n._('Text')}
                        content={i18n._('Enter the text you want to laser engrave or CNC carve.')}
                    >
                        <div className="sm-flex height-80 margin-vertical-8">
                            <TextAreaInput
                                ref={textArea}
                                disabled={disabled}
                                onFocus={actions.onSelectAllText}
                                style={{ resize: 'none' }}
                                className="sm-flex-width"
                                rows="3"
                                value={text}
                                onChange={actions.onChangeText}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('Font')}
                        content={i18n._('Select the font of the text.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-auto sm-flex-order-negative width-56">{i18n._('Font')}</span>
                            <Select
                                disabled={disabled}
                                className="sm-flex-width align-r"
                                clearable={false}
                                size="super-large"
                                options={fontOptions}
                                placeholder={i18n._('Choose font')}
                                value={fontFamily}
                                onChange={actions.onChangeFont}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('Font Size')}
                        content={i18n._('Select the font size of the text.')}
                    >
                        <div className="sm-flex height-32 margin-vertical-8">
                            <span className="sm-flex-auto sm-flex-order-negative width-64">{i18n._('Font Size')}</span>
                            <Input
                                suffix="pt"
                                disabled={disabled}
                                className="sm-flex-width align-r"
                                value={parseInt(fontSize, 10)}
                                onChange={actions.onChangeSize}
                            />
                        </div>
                    </TipTrigger>
                    <TipTrigger
                        title={i18n._('Alignment')}
                        content={i18n._('Align the text in different lines to either the left or right or in the center horizontally.')}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Alignment')}</span>
                            <span className={styles.textAlignWrap}>
                                <button
                                    className={classNames(
                                        styles.textAlignButton,
                                        { [styles.active]: alignment === 'left' }
                                    )}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => { actions.onChangeAlignment('left'); }}
                                >
                                    <SvgIcon name="IconAlignLeft" size={16} color="#666666" />
                                </button>
                                <button
                                    type="button"
                                    className={classNames(
                                        styles.textAlignButton,
                                        { [styles.active]: alignment === 'middle' },
                                    )}
                                    disabled={disabled}
                                    onClick={() => { actions.onChangeAlignment('middle'); }}
                                >
                                    <SvgIcon name="IconAlignCenter" size={16} color="#666666" />
                                </button>
                                <button
                                    className={classNames(
                                        styles.textAlignButton,
                                        { [styles.active]: alignment === 'right' },
                                    )}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => { actions.onChangeAlignment('right'); }}
                                >
                                    <SvgIcon name="IconAlignRight" size={16} color="#666666" />
                                </button>
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
