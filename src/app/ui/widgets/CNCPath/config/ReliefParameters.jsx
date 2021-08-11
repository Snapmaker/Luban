import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import i18n from '../../../../lib/i18n';
import { actions as editorActions } from '../../../../flux/editor';
import Checkbox from '../../../components/Checkbox';
import TipTrigger from '../../../components/TipTrigger';

class ReliefParameters extends PureComponent {
    static propTypes = {
        invert: PropTypes.bool,
        disabled: PropTypes.bool,
        updateSelectedModelConfig: PropTypes.func.isRequired,
        processSelectedModel: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleInvert: () => {
            const invert = !this.props.invert;
            this.props.updateSelectedModelConfig({ invert });
        }
    };

    render() {
        const { invert, disabled } = this.props;

        return (
            <div>
                {this.state.expanded && (
                    <React.Fragment>
                        <TipTrigger
                            title={i18n._('Invert')}
                            content={i18n._('Inverts the color of images, white becomes black, and black becomes white. ')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Invert')}</span>
                                <Checkbox
                                    disabled={disabled}
                                    className="sm-flex-auto"
                                    defaultChecked={invert}
                                    onChange={() => {
                                        this.actions.onToggleInvert();
                                        this.props.processSelectedModel();
                                    }}
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
    const { modelGroup } = state.cnc;

    const selectedModels = modelGroup.getSelectedModelArray();

    let invert = false;

    if (selectedModels.length === 1) {
        const model = selectedModels[0];
        invert = model.config.invert;
    }

    return {
        invert
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (params) => dispatch(editorActions.updateSelectedModelConfig('cnc', params)),
        processSelectedModel: () => dispatch(editorActions.processSelectedModel('cnc'))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ReliefParameters);
