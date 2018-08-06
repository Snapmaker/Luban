import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import i18n from '../../lib/i18n';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/modules/laser';
import styles from './styles.styl';


class TextMode extends PureComponent {
    static propTypes = {
        target: PropTypes.object.isRequired,
        params: PropTypes.object.isRequired,
        fontOptions: PropTypes.array.isRequired,
        init: PropTypes.func.isRequired,
        setTarget: PropTypes.func.isRequired,
        setParams: PropTypes.func.isRequired,
        preview: PropTypes.func.isRequired
    };

    static alignmentOptions = [
        { label: i18n._('Left'), value: 'left' },
        { label: i18n._('Middle'), value: 'middle' },
        { label: i18n._('Right'), value: 'right' }
    ];

    // TODO: if B&W, Greyscale, Vector all use anchor option, then move these options to constants
    static anchorOptions = [
        { label: i18n._('Center'), value: 'Center' },
        { label: i18n._('Left'), value: 'Left' },
        { label: i18n._('Right'), value: 'Right' },
        { label: i18n._('Bottom Left'), value: 'Bottom Left' },
        { label: i18n._('Bottom Middle'), value: 'Bottom Middle' },
        { label: i18n._('Bottom Right'), value: 'Bottom Right' },
        { label: i18n._('Top Left'), value: 'Top Left' },
        { label: i18n._('Top Middle'), value: 'Top Middle' },
        { label: i18n._('Top Right'), value: 'Top Right' }
    ];

    // bound actions to avoid re-creation
    actions = {
        onChangeText: (event) => {
            this.props.setParams({ text: event.target.value });
        },
        onChangeFont: (option) => {
            this.props.setParams({ font: option.value });
        },
        onChangeSize: (size) => {
            this.props.setParams({ size });
        },
        onChangeLineHeight: (lineHeight) => {
            this.props.setParams({ lineHeight });
        },
        onChangeAlignment: (option) => {
            this.props.setParams({ alignment: option.value });
        },
        onChangeAnchor: (option) => {
            this.props.setTarget({ anchor: option.value });
        }
    };

    componentDidMount() {
        this.props.init();
    }

    render() {
        const { target, params, fontOptions, preview } = this.props;
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
                                        value={params.text}
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
                                <TipTrigger
                                    title={i18n._('Font')}
                                    content={i18n._('Select a word font.')}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={fontOptions}
                                        placeholder={i18n._('Choose font')}
                                        value={params.font}
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
                                        value={params.size}
                                        onChange={actions.onChangeSize}
                                    />
                                    <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>pt</span>
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
                                        value={params.lineHeight}
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
                                        options={TextMode.alignmentOptions}
                                        placeholder="Alignment"
                                        value={params.alignment}
                                        onChange={actions.onChangeAlignment}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Anchor')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Anchor')}
                                    content={i18n._('Find the anchor of the text to correspond to the (0, 0) coordinate.')}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={TextMode.anchorOptions}
                                        placeholder="Anchor"
                                        value={target.anchor}
                                        onChange={actions.onChangeAnchor}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                    className={classNames(styles.btn, styles['btn-large-blue'])}
                    onClick={preview}
                >
                    {i18n._('Preview')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const fonts = state.laser.fonts;
    const fontOptions = fonts.map((font) => ({
        label: font.displayName,
        value: font.fontFamily
    }));
    return {
        stage: state.laser.stage,
        target: state.laser.target,
        params: state.laser.textMode,
        fontOptions: fontOptions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        init: () => dispatch(actions.textModeInit()),
        setTarget: (params) => dispatch(actions.targetSetState(params)),
        setParams: (state) => dispatch(actions.textModeSetState(state)),
        preview: () => dispatch(actions.textModePreview())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TextMode);
