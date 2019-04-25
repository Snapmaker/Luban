import React, { PureComponent } from 'react';
import Select from 'react-select';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
// import { toFixed } from '../../lib/numeric-utils';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown/OptionalDropdown';
import { actions } from '../../reducers/cncLaserShared';
import styles from '../styles.styl';

class ConfigSvgVector extends PureComponent {
    static propTypes = {
        size: PropTypes.object.isRequired,
        model: PropTypes.object,
        pathType: PropTypes.string,
        targetDepth: PropTypes.number,
        stepDown: PropTypes.number,
        safetyHeight: PropTypes.number,
        stopHeight: PropTypes.number,
        enableTab: PropTypes.bool,
        tabWidth: PropTypes.number,
        tabHeight: PropTypes.number,
        tabSpace: PropTypes.number,
        anchor: PropTypes.string,
        updateSelectedModelConfig: PropTypes.func.isRequired
    };

    actions = {
        // config
        onChangePathType: (options) => {
            this.props.updateSelectedModelConfig({ pathType: options.value });
        },
        onChangeTargetDepth: (targetDepth) => {
            if (targetDepth > this.props.size.z) {
                return;
            }
            this.props.updateSelectedModelConfig({ targetDepth: targetDepth });
            if (targetDepth < this.props.stepDown) {
                this.props.updateSelectedModelConfig({ stepDown: targetDepth });
            }
            if (-targetDepth > this.props.tabHeight) {
                this.props.updateSelectedModelConfig({ stepDown: -targetDepth });
            }
        },
        onChangeStepDown: (stepDown) => {
            this.props.updateSelectedModelConfig({ stepDown: stepDown });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.updateSelectedModelConfig({ safetyHeight: safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.updateSelectedModelConfig({ stopHeight: stopHeight });
        },
        onToggleEnableTab: () => {
            const enableTab = !this.props.enableTab;
            this.props.updateSelectedModelConfig({ enableTab: enableTab });
        },
        onTabWidth: (tabWidth) => {
            this.props.updateSelectedModelConfig({ tabWidth: tabWidth });
        },
        onTabHeight: (tabHeight) => {
            this.props.updateSelectedModelConfig({ tabHeight: tabHeight });
        },
        onTabSpace: (tabSpace) => {
            this.props.updateSelectedModelConfig({ tabSpace: tabSpace });
        }
    };

    render() {
        if (!this.props.model) {
            return null;
        }

        const actions = this.actions;
        const { size } = this.props;
        const { pathType, targetDepth, stepDown, safetyHeight, stopHeight, enableTab, tabWidth, tabHeight, tabSpace } = this.props;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']} style={{ marginBottom: '10px' }}>
                    <tbody>
                        <tr>
                            <td>{i18n._('Carve Path')}</td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Carve Path')}
                                    content={(
                                        <div>
                                            <p>{i18n._('Select a carve path:')}</p>
                                            <ul>
                                                <li><b>{i18n._('On the Path')}</b>: {i18n._('Carve along the shape of the image.')}</li>
                                                <li><b>{i18n._('Outline')}</b>: {i18n._('Carve along the contour of the image.')}</li>
                                                <li><b>{i18n._('Pocket')}</b>: {i18n._('Pocket inner fills of the image.')}</li>
                                            </ul>
                                        </div>
                                    )}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        className="sm"
                                        clearable={false}
                                        menuContainerStyle={{ zIndex: 5 }}
                                        name="carvePath"
                                        options={[
                                            {
                                                label: i18n._('On the Path'),
                                                value: 'path'
                                            },
                                            {
                                                label: i18n._('Outline'),
                                                value: 'outline'
                                            },
                                            {
                                                label: i18n._('Pocket'),
                                                value: 'pocket'
                                            }
                                        ]}
                                        placeholder={i18n._('Choose carve path')}
                                        value={pathType}
                                        onChange={actions.onChangePathType}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Target Depth')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Target Depth')}
                                    content={i18n._('Enter the depth of the carved image. The depth cannot be deeper than the flute length.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={targetDepth}
                                            min={0.01}
                                            max={size.z}
                                            step={0.1}
                                            onChange={actions.onChangeTargetDepth}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Step Down')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Step Down')}
                                    content={i18n._('Enter the depth of each carving step.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={stepDown}
                                            min={0.01}
                                            max={targetDepth}
                                            step={0.1}
                                            onChange={actions.onChangeStepDown}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Jog Height')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Jog Height')}
                                    content={i18n._('The distance between the tool and the material when it’s not carving.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={safetyHeight}
                                            min={0.1}
                                            max={size.z}
                                            step={1}
                                            onChange={actions.onChangeSafetyHeight}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Stop Height')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Stop Height')}
                                    content={i18n._('The distance between the tool and the material when the machine stops.')}
                                >
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            style={{ width: '45%' }}
                                            value={stopHeight}
                                            min={0.1}
                                            max={size.z}
                                            step={1}
                                            onChange={actions.onChangeStopHeight}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {(pathType === 'path' || pathType === 'outline') && (
                    <OptionalDropdown
                        title={i18n._('Tabs')}
                        onClick={actions.onToggleEnableTab}
                        hidden={!enableTab}
                    >
                        <table className={styles['parameter-table']}>
                            <tbody>
                                <tr>
                                    <td>
                                        {i18n._('Tab Height')}
                                    </td>
                                    <td>
                                        <TipTrigger
                                            title={i18n._('Tab Height')}
                                            content={i18n._('Enter the height of the tabs.')}
                                        >
                                            <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                                <Input
                                                    style={{ width: '45%' }}
                                                    value={tabHeight}
                                                    min={-targetDepth}
                                                    max={0}
                                                    step={0.5}
                                                    onChange={actions.onTabHeight}
                                                    disabled={!enableTab}
                                                />
                                                <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                            </div>
                                        </TipTrigger>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        {i18n._('Tab Space')}
                                    </td>
                                    <td>
                                        <TipTrigger
                                            title={i18n._('Tab Space')}
                                            content={i18n._('Enter the space between any two tabs.')}
                                        >
                                            <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                                <Input
                                                    style={{ width: '45%' }}
                                                    value={tabSpace}
                                                    min={1}
                                                    step={1}
                                                    onChange={actions.onTabSpace}
                                                    disabled={!enableTab}
                                                />
                                                <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                            </div>
                                        </TipTrigger>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        {i18n._('Tab Width')}
                                    </td>
                                    <td>
                                        <TipTrigger
                                            title={i18n._('Tab Width')}
                                            content={i18n._('Enter the width of the tabs.')}
                                        >
                                            <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                                <Input
                                                    style={{ width: '45%' }}
                                                    value={tabWidth}
                                                    min={1}
                                                    step={1}
                                                    onChange={actions.onTabWidth}
                                                    disabled={!enableTab}
                                                />
                                                <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                            </div>
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
    const machine = state.machine;
    const { model, config } = state.cnc;
    const {
        pathType, targetDepth, stepDown, safetyHeight, stopHeight,
        enableTab, tabWidth, tabHeight, tabSpace, anchor
    } = config;

    return {
        size: machine.size,
        model,
        pathType,
        targetDepth,
        stepDown,
        safetyHeight,
        stopHeight,
        enableTab,
        tabWidth,
        tabHeight,
        tabSpace,
        anchor
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelConfig: (params) => dispatch(actions.updateSelectedModelConfig('cnc', params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigSvgVector);
