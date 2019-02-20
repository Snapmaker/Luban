import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import { toFixed } from '../../lib/numeric-utils';
import { NumberInput } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions } from '../../reducers/cnc';
import styles from '../styles.styl';


class Transformation extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        model: PropTypes.object,
        width: PropTypes.number,
        height: PropTypes.number,
        updateSelectedModelTransformation: PropTypes.func.isRequired
    };

    actions = {
        // transformation
        onChangeWidth: (width) => {
            this.props.updateSelectedModelTransformation({ width });
        },
        onChangeHeight: (height) => {
            this.props.updateSelectedModelTransformation({ height });
        }
    };

    render() {
        if (!this.props.model) {
            return null;
        }

        const actions = this.actions;
        const { size, width, height } = this.props;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']} style={{ marginBottom: '10px' }}>
                    <tbody>
                        <tr>
                            <td>
                                {i18n._('Size (mm)')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Size')}
                                    content={i18n._('Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material.')}
                                >
                                    <NumberInput
                                        style={{ width: '45%' }}
                                        value={toFixed(width, 1)}
                                        min={1}
                                        max={size.x}
                                        onChange={actions.onChangeWidth}
                                    />
                                    <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <NumberInput
                                        style={{ width: '45%' }}
                                        value={toFixed(height, 1)}
                                        min={1}
                                        max={size.y}
                                        onChange={actions.onChangeHeight}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { model, transformation } = state.cnc;
    const { width, height } = transformation;

    return {
        size: machine.size,
        model: model,
        width: width,
        height: height
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelTransformation: (params) => dispatch(actions.updateSelectedModelTransformation(params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Transformation);
