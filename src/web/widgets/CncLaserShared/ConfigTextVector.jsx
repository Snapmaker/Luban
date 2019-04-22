import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import { connect } from 'react-redux';
import Select from 'react-select';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as textActions } from '../../reducers/text';
import styles from './styles.styl';
import OptionalDropdown from '../../components/OptionalDropdown';


class ConfigTextVector extends PureComponent {
    static propTypes = {
        withFill: PropTypes.bool,
        fontOptions: PropTypes.array,
        config: PropTypes.shape({
            text: PropTypes.string,
            size: PropTypes.number,
            font: PropTypes.string,
            lineHeight: PropTypes.number,
            alignment: PropTypes.string,
            fillEnabled: PropTypes.bool,
            fillDensity: PropTypes.number
        }),
        uploadFont: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    actions = {
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
        },
        onToggleFill: () => {
            const fillEnabled = !this.props.config.fillEnabled;
            this.props.updateSelectedModelTextConfig({ fillEnabled });
        },
        onChangeFillDensity: (fillDensity) => {
            this.props.updateSelectedModelTextConfig({ fillDensity });
        }
    };

    render() {
        const { config, fontOptions } = this.props;
        const { text, size, font, lineHeight, alignment, fillEnabled, fillDensity } = config;
        const actions = this.actions;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Text')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Text')}
                                    content={i18n._('Enter the text you want to engrave. \
The maximum length of the text is 125 mm. When the text is too long, it will be shrunk automatically. \
Start a new line manually according to your needs.')}
                                >
                                    <textarea
                                        className="form-control"
                                        rows="3"
                                        value={text}
                                        onChange={actions.onChangeText}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Font')}
                            </td>
                            <td>
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
                                        height: '34px'
                                    }}
                                    className="sm-btn-small sm-btn-default"
                                    title={i18n._('Upload')}
                                    onClick={actions.onClickUpload}
                                >
                                    <i className="fa fa-upload" />
                                </button>
                                <TipTrigger
                                    title={i18n._('Font')}
                                    content={i18n._('Select a word font or upload a font from your computer. WOFF, TTF, OTF fonts are supported.')}
                                    style={{
                                        display: 'inline-block',
                                        width: '83%'
                                    }}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={fontOptions}
                                        placeholder={i18n._('Choose font')}
                                        value={font}
                                        onChange={actions.onChangeFont}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Size')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Size')}
                                    content={i18n._('Enter the font size in pt (points).')}
                                >
                                    <Input
                                        style={{ width: '45%' }}
                                        value={size}
                                        onChange={actions.onChangeSize}
                                    />
                                    <span className={styles['description-text']} style={{ margin: '0px 0 0 -20px' }}>pt</span>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Line Height')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Line Height')}
                                    content={i18n._('Set the distance between each line in the text. The value you enter is the multiple of the font size.')}
                                >
                                    <Input
                                        style={{ width: '45%' }}
                                        value={lineHeight}
                                        onChange={actions.onChangeLineHeight}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Alignment')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Alignment')}
                                    content={i18n._('Align the text in different lines to either the left or right or in the center horizontally.')}
                                >
                                    <Select
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
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {this.props.withFill && (
                    <OptionalDropdown
                        title={i18n._('Fill')}
                        onClick={actions.onToggleFill}
                        hidden={!fillEnabled}
                    >
                        <table className={styles['parameter-table']}>
                            <tbody>
                                <tr>
                                    <td>
                                        {i18n._('Fill Density')}
                                    </td>
                                    <td>
                                        <TipTrigger
                                            title={i18n._('Fill Density')}
                                            content={i18n._('Set the degree to which an area is filled with laser dots. The highest density is 20 dot/mm. When it is set to 0, the text will be engraved without fill.')}
                                        >
                                            <div style={{ display: 'inline-block', width: '50%' }}>
                                                <Slider
                                                    value={fillDensity}
                                                    min={0}
                                                    max={20}
                                                    onChange={this.actions.onChangeFillDensity}
                                                />
                                            </div>
                                            <div style={{ display: 'inline-block', width: '10%' }} />
                                            <Input
                                                style={{ width: '40%' }}
                                                value={fillDensity}
                                                min={0}
                                                max={20}
                                                onChange={actions.onChangeFillDensity}
                                            />
                                            <span className={styles['description-text']} style={{ margin: '0 0 0 -50px' }}>dot/mm</span>
                                        </TipTrigger>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </OptionalDropdown>
                )}
            </React.Fragment>
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

export default connect(mapStateToProps, mapDispatchToProps)(ConfigTextVector);
