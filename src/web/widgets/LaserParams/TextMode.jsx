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
        fonts: PropTypes.array.isRequired,
        setState: PropTypes.func.isRequired,
        onPreview: PropTypes.func.isRequired
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

    render() {
        const { params, fonts, onPreview } = this.props;
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
                                    options={fonts}
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
                    onClick={onPreview}
                >
                    Preview
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const fonts = [
        'Droid Sans',
        'Roboto'
    ];
    const fontOptions = fonts.map(font => ({
        label: font,
        value: font
    }));
    return {
        stage: state.laser.stage,
        params: state.laser.textMode,
        fonts: fontOptions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setState: (state) => dispatch(actions.textModeSetState(state)),
        onPreview: () => dispatch(actions.textModePreview())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(TextMode);
