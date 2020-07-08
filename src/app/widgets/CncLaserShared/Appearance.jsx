import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
// import Select from 'react-select';
// import { IconAlignLeft, IconAlignCenter, IconAlignRight } from 'snapmaker-react-icon';
// import styles from './styles.styl';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import { actions as textActions } from '../../flux/text';


class Appearance extends PureComponent {
    static propTypes = {
        disabled: PropTypes.bool,
        config: PropTypes.shape({
            'stroke-width': PropTypes.string,
            text: PropTypes.string,
            'font-size': PropTypes.string,
            'font-family': PropTypes.string,
            lineHeight: PropTypes.number,
            alignment: PropTypes.string
        }),
        uploadFont: PropTypes.func.isRequired,
        // updateSelectedModelTextConfig: PropTypes.func.isRequired,
        selectedModel: PropTypes.object.isRequired
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
            this.props.selectedModel.relatedModels.svgModel.elem.textContent = text;
            this.props.selectedModel.updateAndRefresh({ ...this.getBaseUpdateData(), config: { text } });
        },
        onChangeFont: (option) => {
            if (option.value === 'AddFonts') {
                this.actions.onClickUpload();
                return;
            }
            const font = option.value;
            this.props.selectedModel.relatedModels.svgModel.elem.setAttribute('font-family', font);
            this.props.selectedModel.updateAndRefresh({ ...this.getBaseUpdateData(), config: { 'font-family': font } });
            // this.props.updateSelectedModelTextConfig({ 'font-family': font });
        },

        onChangeSize: (size) => {
            this.props.selectedModel.relatedModels.svgModel.elem.setAttribute('font-size', size);
            this.props.selectedModel.updateAndRefresh({ ...this.getBaseUpdateData(), config: { 'font-size': size } });
            // this.props.updateSelectedModelTextConfig({ size });
        },
        onChangeConfig: (key, value) => {
            this.props.selectedModel.relatedModels.svgModel.elem.setAttribute(key, value);
            this.props.selectedModel.updateAndRefresh({ ...this.getBaseUpdateData(), config: { [key]: value } });
        }
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
        const { width, height } = this.props.selectedModel.relatedModels.svgModel.elem.getBBox();
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
        const { config, disabled } = this.props;
        const { 'stroke-width': strokeWidth } = config;
        const actions = this.actions;

        return (
            <div>
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-font sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Appearance')}</span>
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
                            title={i18n._('Stroke Width')}
                            content={i18n._('Enter the stroke width in pt (points).')}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Stroke Width')}</span>
                                <Input
                                    disabled={disabled}
                                    className="sm-parameter-row__input"
                                    value={parseFloat(strokeWidth, 10)}
                                    onChange={(value) => {
                                        actions.onChangeConfig('stroke-width', `${value}`);
                                    }}
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
    fontOptions.unshift({
        label: `+ ${i18n._('Add Fonts')}`,
        value: 'AddFonts'
    });
    return {
        fontOptions
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadFont: (file) => dispatch(textActions.uploadFont(file))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Appearance);
