import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Select from 'react-select';
import { NumberInput as Input } from '../../components/Input';
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
        { label: 'Left', value: 'left' },
        { label: 'Middle', value: 'middle' },
        { label: 'Right', value: 'right' }
    ];

    // TODO: if B&W, Greyscale, Vector all use anchor option, then move these options to constants
    static anchorOptions = [
        { label: 'Center', value: 'Center' },
        { label: 'Left', value: 'Left' },
        { label: 'Right', value: 'Right' },
        { label: 'Bottom Left', value: 'Bottom Left' },
        { label: 'Bottom Middle', value: 'Bottom Middle' },
        { label: 'Bottom Right', value: 'Bottom Right' },
        { label: 'Top Left', value: 'Top Left' },
        { label: 'Top Middle', value: 'Top Middle' },
        { label: 'Top Right', value: 'Top Right' }
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
                                Text
                            </td>
                            <td>
                                <textarea
                                    className="form-control"
                                    rows="3"
                                    value={params.text}
                                    onChange={actions.onChangeText}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Font
                            </td>
                            <td>
                                <Select
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
                                    options={fontOptions}
                                    placeholder="choose font"
                                    value={params.font}
                                    onChange={actions.onChangeFont}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Size
                            </td>
                            <td>
                                <Input
                                    style={{ width: '45%' }}
                                    value={params.size}
                                    onChange={actions.onChangeSize}
                                />
                                <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>pt</span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Line Height
                            </td>
                            <td>
                                <Input
                                    style={{ width: '45%' }}
                                    value={params.lineHeight}
                                    onChange={actions.onChangeLineHeight}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Alignment
                            </td>
                            <td>
                                <Select
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
                                    options={TextMode.alignmentOptions}
                                    placeholder="Alignment"
                                    value={params.alignment}
                                    onChange={actions.onChangeAlignment}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Anchor
                            </td>
                            <td>
                                <Select
                                    backspaceRemoves={false}
                                    clearable={false}
                                    searchable={false}
                                    options={TextMode.anchorOptions}
                                    placeholder="Anchor"
                                    value={target.anchor}
                                    onChange={actions.onChangeAnchor}
                                />
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
                    Preview
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const fonts = state.laser.fonts;
    const fontOptions = fonts.map((font) => ({
        label: font.fontFamily,
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
