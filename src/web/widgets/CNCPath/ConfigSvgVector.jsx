import React, { PureComponent } from 'react';
import Select from 'react-select';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
    BOUND_SIZE
} from '../../constants';
import i18n from '../../lib/i18n';
// import { toFixed } from '../../lib/numeric-utils';
import { NumberInput as Input } from '../../components/Input';
import Space from '../../components/Space';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown/OptionalDropdown';
import { actions } from '../../reducers/cnc';
import styles from '../styles.styl';

class ConfigSvgVector extends PureComponent {
    static propTypes = {
        anchorOptions: PropTypes.array.isRequired,
        model: PropTypes.object,
        pathType: PropTypes.string,
        targetDepth: PropTypes.number,
        stepDown: PropTypes.number,
        safetyHeight: PropTypes.number,
        stopHeight: PropTypes.number,
        clip: PropTypes.bool,
        enableTab: PropTypes.bool,
        tabWidth: PropTypes.number,
        tabHeight: PropTypes.number,
        tabSpace: PropTypes.number,
        anchor: PropTypes.string,
        updateConfig: PropTypes.func.isRequired
    };

    actions = {
        // config
        onChangePathType: (options) => {
            this.props.updateConfig({ pathType: options.value });
        },
        onChangeTargetDepth: (targetDepth) => {
            if (targetDepth > BOUND_SIZE) {
                return;
            }
            this.props.updateConfig({ targetDepth: targetDepth });
            if (targetDepth < this.props.stepDown) {
                this.props.updateConfig({ stepDown: targetDepth });
            }
            if (-targetDepth > this.props.tabHeight) {
                this.props.updateConfig({ stepDown: -targetDepth });
            }
        },
        onChangeStepDown: (stepDown) => {
            this.props.updateConfig({ stepDown: stepDown });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.updateConfig({ safetyHeight: safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.updateConfig({ stopHeight: stopHeight });
        },
        onSelectAnchor: (options) => {
            this.props.updateConfig({ anchor: options.value });
        },
        onToggleClip: () => {
            const clip = !this.props.clip;
            this.props.updateConfig({ clip: clip });
        },
        onToggleEnableTab: () => {
            const enableTab = !this.props.enableTab;
            this.props.updateConfig({ enableTab: enableTab });
        },
        onTabWidth: (tabWidth) => {
            this.props.updateConfig({ tabWidth: tabWidth });
        },
        onTabHeight: (tabHeight) => {
            this.props.updateConfig({ tabHeight: tabHeight });
        },
        onTabSpace: (tabSpace) => {
            this.props.updateConfig({ tabSpace: tabSpace });
        }
    };

    render() {
        if (!this.props.model) {
            return null;
        }

        const actions = this.actions;
        const { anchorOptions, pathType, targetDepth, stepDown,
            safetyHeight, stopHeight, clip, enableTab, tabWidth, tabHeight, tabSpace,
            anchor } = this.props;

        return (
            <React.Fragment>
                <table className={styles['parameter-table']} style={{ marginBottom: '10px' }}>
                    <tbody>
                        <tr>
                            <td>{i18n._('Carving Path')}</td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Carving Path')}
                                    content={(
                                        <div>
                                            <p>{i18n._('Select a carve path:')}</p>
                                            <ul>
                                                <li><b>{i18n._('On the Path')}</b>: {i18n._('Carve along the shape of the image.')}</li>
                                                <li><b>{i18n._('Outline')}</b>: {i18n._('Carve along the contour of the image.')}</li>
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
                                            max={BOUND_SIZE}
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
                                            max={BOUND_SIZE}
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
                                            max={BOUND_SIZE}
                                            step={1}
                                            onChange={actions.onChangeStopHeight}
                                        />
                                        <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td />
                            <td>
                                <input
                                    type="checkbox"
                                    defaultChecked={clip}
                                    onChange={actions.onToggleClip}
                                />
                                <Space width={4} />
                                <span>{i18n._('Clip')}</span>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Anchor')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Anchor')}
                                    content={i18n._('Find the anchor of the image to correspond to the (0, 0) coordinate.')}
                                >
                                    <Select
                                        backspaceRemoves={false}
                                        clearable={false}
                                        searchable={false}
                                        options={anchorOptions}
                                        value={anchor}
                                        onChange={actions.onSelectAnchor}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
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
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const anchorOptions = [
        { label: i18n._('Center'), value: 'Center' },
        { label: i18n._('Center Left'), value: 'Center Left' },
        { label: i18n._('Center Right'), value: 'Center Right' },
        { label: i18n._('Bottom Left'), value: 'Bottom Left' },
        { label: i18n._('Bottom Middle'), value: 'Bottom Middle' },
        { label: i18n._('Bottom Right'), value: 'Bottom Right' },
        { label: i18n._('Top Left'), value: 'Top Left' },
        { label: i18n._('Top Middle'), value: 'Top Middle' },
        { label: i18n._('Top Right'), value: 'Top Right' }
    ];
    const { model, config } = state.cnc;
    const { pathType, targetDepth, stepDown, safetyHeight, stopHeight,
        clip, enableTab, tabWidth, tabHeight, tabSpace, anchor } = config;

    return {
        anchorOptions,
        model,
        pathType,
        targetDepth,
        stepDown,
        safetyHeight,
        stopHeight,
        clip,
        enableTab,
        tabWidth,
        tabHeight,
        tabSpace,
        anchor
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateConfig: (params) => dispatch(actions.updateConfig(params))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(ConfigSvgVector);
