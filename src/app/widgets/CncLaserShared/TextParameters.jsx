import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';

import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as textActions } from '../../reducers/text';


class TextParameters extends PureComponent {
    static propTypes = {
        fontOptions: PropTypes.array,
        config: PropTypes.shape({
            text: PropTypes.string,
            size: PropTypes.number,
            font: PropTypes.string,
            lineHeight: PropTypes.number,
            alignment: PropTypes.string
        }),
        uploadFont: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    fileInput = React.createRef();

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        onClickUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.props.uploadFont(file);
        },
        onChangeText: (event) => {
            const text = event.target.value;
            this.props.updateSelectedModelTextConfig({ text });
        },
        onChangeFont: (option) => {
            const font = option.value;
            this.props.updateSelectedModelTextConfig({ font });
        },
        onChangeSize: (size) => {
            this.props.updateSelectedModelTextConfig({ size });
        },
        onChangeLineHeight: (lineHeight) => {
            this.props.updateSelectedModelTextConfig({ lineHeight });
        },
        onChangeAlignment: (option) => {
            const alignment = option.value;
            this.props.updateSelectedModelTextConfig({ alignment });
        }
    };

    render() {
        const { config, fontOptions } = this.props;
        const { text, size, font, lineHeight, alignment } = config;
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
                                    style={{ width: '202px', float: 'right', resize: 'none' }}
                                    className="form-control"
                                    rows="3"
                                    value={text}
                                    onChange={actions.onChangeText}
                                />
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Font')}
                            content={i18n._('Select a word font or upload a font from your computer. WOFF, TTF, OTF fonts are supported.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Font')}</span>
                                <input
                                    ref={this.fileInput}
                                    type="file"
                                    accept=".woff, .ttf, .otf"
                                    style={{ display: 'none' }}
                                    multiple={false}
                                    onChange={actions.onChangeFile}
                                />
                                <button
                                    type="button"
                                    style={{
                                        display: 'inline-block',
                                        width: '15%',
                                        float: 'right',
                                        padding: '5px 6px',
                                        marginLeft: '4px',
                                        height: '30px'
                                    }}
                                    className="sm-btn-small sm-btn-default"
                                    title={i18n._('Upload')}
                                    onClick={actions.onClickUpload}
                                >
                                    <i className="fa fa-upload" />
                                </button>
                                <Select
                                    className="sm-parameter-row__select"
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
                                    options={fontOptions}
                                    placeholder={i18n._('Choose font')}
                                    value={font}
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
                                    className="sm-parameter-row__input"
                                    value={size}
                                    onChange={actions.onChangeSize}
                                />
                                <span className="sm-parameter-row__input-unit">pt</span>
                            </div>
                        </TipTrigger>
                        <TipTrigger
                            title={i18n._('Line Height')}
                            content={i18n._('Set the distance between each line in the text. The value you enter is the multiple of the font size.')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Line Height')}</span>
                                <Input
                                    className="sm-parameter-row__input"
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
                                <Select
                                    className="sm-parameter-row__select"
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
                                    options={[
                                        { label: i18n._('Left'), value: 'left' },
                                        { label: i18n._('Middle'), value: 'middle' },
                                        { label: i18n._('Right'), value: 'right' }
                                    ]}
                                    placeholder={i18n._('Alignment')}
                                    value={alignment}
                                    onChange={actions.onChangeAlignment}
                                />
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

const mapDispatchToProps = (dispatch) => {
    return {
        uploadFont: (file) => dispatch(textActions.uploadFont(file)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TextParameters);
