import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
// import { IconAlignLeft, IconAlignCenter, IconAlignRight } from 'snapmaker-react-icon';
// import styles from './styles.styl';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as textActions } from '../../flux/text';


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
        uploadFont: PropTypes.func.isRequired,
        // updateSelectedModelTextConfig: PropTypes.func.isRequired,
        // todo, all selectedModel use selectedModelArray[0] now
        selectedModelArray: PropTypes.array.isRequired
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
            const model = this.props.selectedModelArray[0];
            const text = event.target.value;
            // todo, move to editor
            model.relatedModels.svgModel.elem.textContent = text;
            model.updateAndRefresh({ ...this.getBaseUpdateData(), config: { text } });
            model.relatedModels.svgModel.modelGroup.resetSelection();

            // this.props.updateSelectedModelTextConfig({ text });
        },
        onChangeFont: (option) => {
            if (option.value === 'AddFonts') {
                this.actions.onClickUpload();
                return;
            }
            const model = this.props.selectedModelArray[0];
            const font = option.value;
            // todo, move to editor
            model.relatedModels.svgModel.elem.setAttribute('font-family', font);
            model.updateAndRefresh({ ...this.getBaseUpdateData(), config: { 'font-family': font } });
            model.relatedModels.svgModel.modelGroup.resetSelection();
        },
        onChangeSize: (size) => {
            const model = this.props.selectedModelArray[0];
            // todo, move to editor
            model.relatedModels.svgModel.elem.setAttribute('font-size', size);
            model.updateAndRefresh({ ...this.getBaseUpdateData(), config: { 'font-size': size } });
            model.relatedModels.svgModel.modelGroup.resetSelection();
            // this.props.updateSelectedModelTextConfig({ size });
        } // ,
        // onChangeLineHeight: (lineHeight) => {
        //     this.props.selectedModel.updateAndRefresh({ lineHeight });
        //     // this.props.updateSelectedModelTextConfig({ lineHeight });
        // },
        // onChangeAlignment: (option) => {
        //     const alignment = option.value;
        //     this.props.selectedModel.updateAndRefresh({ alignment });
        //     // this.props.updateSelectedModelTextConfig({ alignment });
        // }
    };

    getBaseUpdateData() {
        const model = this.props.selectedModelArray[0];
        const { width, height } = model.relatedModels.svgModel.elem.getBBox();
        return {
            sourceWidth: width * 8,
            sourceHeight: height * 8,
            width,
            height,
            transformation: {
                width,
                height
            }
        };
    }

    render() {
        const { config, fontOptions, disabled } = this.props;
        const { text, 'font-size': fontSize, 'font-family': fontFamily } = config;
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
                                    disabled={disabled}
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
                                {/* <input
                                    disabled={disabled}
                                    ref={this.fileInput}
                                    type="file"
                                    accept=".woff, .ttf, .otf"
                                    style={{ display: 'none' }}
                                    multiple={false}
                                    onChange={actions.onChangeFile}
                                />
                                <button
                                    disabled={disabled}
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
                                </button> */}
                                <Select
                                    disabled={disabled}
                                    className="sm-parameter-row__font-select"
                                    // style={{ width: '202px', float: 'right' }}
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
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
                                        { label: i18n._('1.0'), value: 1 },
                                        { label: i18n._('1.2'), value: 1.2 },
                                        { label: i18n._('1.5'), value: 1.5 },
                                        { label: i18n._('2.0'), value: 2 }
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

const mapStateToProps = (state, props) => {
    const { headType } = props;
    const { fonts } = state.text;
    const fontOptions = fonts.map((font) => ({
        label: font.displayName,
        value: font.fontFamily
    }));
    const { modelGroup } = state[headType];
    const selectedModelArray = modelGroup.getSelectedModelArray();
    return {
        fontOptions,
        selectedModelArray
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadFont: (file) => dispatch(textActions.uploadFont(file))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TextParameters);
