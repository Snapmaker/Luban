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
        params: PropTypes.object.isRequired,
        fontOptions: PropTypes.array.isRequired,
        init: PropTypes.func.isRequired,
        setState: PropTypes.func.isRequired,
        preview: PropTypes.func.isRequired
    };

    // bound actions to avoid re-creation
    actions = {
        onChangeText: (event) => {
            this.props.setState({
                text: event.target.value
            });
        },
        onChangeFont: (option) => {
            this.props.setState({
                font: option.value
            });
        },
        onChangeSize: (size) => {
            this.props.setState({ size });
        }
    };

    componentDidMount() {
        this.props.init();
    }

    render() {
        const { params, fontOptions, preview } = this.props;
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
                                    value={params.size}
                                    onChange={actions.onChangeSize}
                                />
                                pt
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
        params: state.laser.textMode,
        fontOptions: fontOptions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        init: () => dispatch(actions.textModeInit()),
        setState: (state) => dispatch(actions.textModeSetState(state)),
        preview: () => dispatch(actions.textModePreview())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TextMode);
