import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from '../../components/Select';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';


class TextParameters extends PureComponent {
    static propTypes = {
        fontOptions: PropTypes.array,
        disabled: PropTypes.bool,
        processTextInfo: PropTypes.shape({
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
            this.textArea.current.select();
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
        const { processTextInfo, fontOptions, disabled } = this.props;
        const { text, 'font-size': fontSize, 'font-family': fontFamily } = processTextInfo;
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-font sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Text')}</span>
                    <span className={classNames(
                        'fa',
                        this.state.expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
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
                            <div className="sm-parameter-row" style={{ height: '68px' }}>
                                <span className="sm-parameter-row__label">{i18n._('Text')}</span>
                                <textarea
                                    ref={this.textArea}
                                    disabled={disabled}
                                    onFocus={actions.onSelectAllText}
                                    style={{ width: '202px', float: 'right', resize: 'none' }}
                                    className="form-control"
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
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Font')}</span>
                                <Select
                                    disabled={disabled}
                                    className="sm-parameter-row__font-select"
                                    // style={{ width: '202px', float: 'right' }}
                                    backspaceRemoves={false}
                                    clearable={false}
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
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Font Size')}</span>
                                <Input
                                    disabled={disabled}
                                    className="sm-parameter-row__input"
                                    value={parseInt(fontSize, 10)}
                                    onChange={actions.onChangeSize}
                                />
                                <span className="sm-parameter-row__input-unit">pt</span>
                            </div>
                        </TipTrigger>
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
