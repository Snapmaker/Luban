import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from '../../components/Select';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import { NumberInput as Input, TextAreaInput } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';


class TextParameters extends PureComponent {
    static propTypes = {
        fontOptions: PropTypes.array,
        disabled: PropTypes.bool,
        config: PropTypes.shape({
            text: PropTypes.string,
            'font-size': PropTypes.string,
            'font-family': PropTypes.string,
            lineHeight: PropTypes.number,
            alignment: PropTypes.string
        }),

        modifyText: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    fileInput = React.createRef();

    textArea = React.createRef();

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onClickUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        onSelectAllText: () => {
            // this.textArea.current.select();
        },
        onChangeText: (event) => {
            const text = event.target.value;

            this.props.modifyText(null, { text });
        },
        onChangeFont: (option) => {
            // Upload font (TODO: not used?)
            if (option.value === 'AddFonts') {
                this.actions.onClickUpload();
                return;
            }

            const font = option.value;

            this.props.modifyText(null, { fontFamily: font });
        },
        onChangeSize: (size) => {
            this.props.modifyText(null, { fontSize: `${size}` });
        }
    };

    render() {
        const { config, fontOptions, disabled } = this.props;
        const { text, 'font-size': fontSize, 'font-family': fontFamily } = config;
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-flex height-32 margin-vertical-8" onClick={this.actions.onToggleExpand}>
                    <span className="sm-flex-width">{i18n._('Text')}</span>
                    <SvgIcon
                        name="DropdownLine"
                        className={classNames(
                            this.state.expanded ? '' : 'rotate180'
                        )}
                    />
                </Anchor>
                {this.state.expanded && (
                    <React.Fragment>
                        <TipTrigger
                            title={i18n._('Text')}
                            content={i18n._('Enter the text you want to engrave. \
The maximum length of the text is 125 mm. When the text is too long, it will be shrunk automatically. \
Start a new line manually according to your needs.')}
                        >
                            <div className="sm-flex height-80 margin-vertical-8">
                                <TextAreaInput
                                    ref={this.textArea}
                                    disabled={disabled}
                                    onFocus={actions.onSelectAllText}
                                    style={{ resize: 'none' }}
                                    className="sm-flex-width"
                                    rows="3"
                                    value={text}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                        }
                                    }}
                                    onChange={actions.onChangeText}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Font')}
                            content={i18n._('Select a font')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-auto sm-flex-order-negative width-56">{i18n._('Font')}</span>
                                <Select
                                    disabled={disabled}
                                    className="sm-flex-width align-r"
                                    clearable={false}
                                    size="large"
                                    options={fontOptions}
                                    placeholder={i18n._('Choose font')}
                                    value={fontFamily}
                                    onChange={actions.onChangeFont}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Font Size')}
                            content={i18n._('Enter the font size in pt (points).')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-auto sm-flex-order-negative width-64">{i18n._('Font Size')}</span>
                                <Input
                                    disabled={disabled}
                                    className="sm-flex-width align-r"
                                    value={parseInt(fontSize, 10)}
                                    onChange={actions.onChangeSize}
                                />
                                <span className="sm-flex__input-unit-24">pt</span>
                            </div>
                        </TipTrigger>
                        {/* <TipTrigger
                            title={i18n._('Line Height')}
                            content={i18n._('Set the distance between each line in the text. The value you enter is the multiple of the font size.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Line Height')}</span>

                                <Select
                                    disabled={disabled}
                                    className="sm-parameter-row__select"
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
                                    options={[
                                    ]}
                                    value={lineHeight}
                                    onChange={actions.onChangeLineHeight}
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
                                        <IconAlignLeft size={16} color="#666666" />
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
                                        <IconAlignCenter size={16} color="#666666" />
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
                                        <IconAlignRight size={16} color="#666666" />
                                    </button>
                                </span>
                            </div>
                        </TipTrigger> */}
                    </React.Fragment>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { fonts } = state.text;
    const fontOptions = fonts.map((font) => ({
        label: font.displayName,
        value: font.fontFamily
    }));
    return {
        fontOptions
    };
};

export default connect(mapStateToProps)(TextParameters);
