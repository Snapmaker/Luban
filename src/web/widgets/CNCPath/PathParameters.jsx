import React, { PureComponent } from 'react';
import Select from 'react-select';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import {
    BOUND_SIZE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT,
    ACTION_REQ_PREVIEW_CNC,
    ACTION_CHANGE_IMAGE_CNC,
    ACTION_CHANGE_PATH
} from '../../constants';
import i18n from '../../lib/i18n';
import { toFixed } from '../../lib/numeric-utils';
import { NumberInput as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown/OptionalDropdown';
import styles from '../styles.styl';


class PathParameters extends PureComponent {
    state = {
        originWidth: DEFAULT_SIZE_WIDTH,
        originHeight: DEFAULT_SIZE_HEIGHT,
        sizeWidth: DEFAULT_SIZE_WIDTH / 10,
        sizeHeight: DEFAULT_SIZE_HEIGHT / 10,

        pathType: 'path', // default
        targetDepth: 2.2,
        stepDown: 0.8,
        safetyHeight: 3,
        stopHeight: 10,
        alignment: 'clip',
        optimizePath: true,

        // tab
        enableTab: false,
        tabWidth: 2,
        tabHeight: -1,
        tabSpace: 24
    };

    actions = {
        onChangePathType: (options) => {
            this.update({ pathType: options.value });
        },
        // carve width (in mm)
        onChangeWidth: (width) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const height = toFixed(width * ratio, 2);
            if (height < 1 || height > BOUND_SIZE) {
                return;
            }

            this.update({
                sizeWidth: width,
                sizeHeight: height
            });
        },
        // carve height (in mm)
        onChangeHeight: (height) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const width = height / ratio;
            if (width <= 0 || width > BOUND_SIZE) {
                return;
            }

            this.update({
                sizeWidth: width,
                sizeHeight: height
            });
        },
        onChangeTargetDepth: (targetDepth) => {
            // TODO: update targetDepth to the height of material (if we can set material parameters)
            if (targetDepth > BOUND_SIZE) {
                return;
            }
            this.update({ targetDepth });
            // TODO: use subscription pattern on changes of dependencies
            if (targetDepth < this.state.stepDown) {
                this.update({ stepDown: targetDepth });
            }
            if (-targetDepth > this.state.tabHeight) {
                this.update({ tabHeight: -targetDepth });
            }
        },
        onChangeStepDown: (stepDown) => {
            this.update({ stepDown });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.update({ safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.update({ stopHeight });
        },
        onSelectAlignment: (options) => {
            this.update({ alignment: options.value });
        },
        onToggleEnableTab: (event) => {
            this.update({ enableTab: !this.state.enableTab });
        },
        onTabHeight: (tabHeight) => {
            this.update({ tabHeight });
        },
        onTabSpace: (tabSpace) => {
            this.update({ tabSpace });
        },
        onTabWidth: (tabWidth) => {
            this.update({ tabWidth });
        },
        onToggleOptimizePath: (event) => {
            this.update({ optimizePath: event.target.checked });
        },
        onClickPreview: () => {
            pubsub.publish(ACTION_REQ_PREVIEW_CNC);
        }
    };
    subscriptions = [];

    update(state) {
        this.setState(state);
        pubsub.publish(ACTION_CHANGE_PATH, state);
    }

    componentDidMount() {
        this.subscriptions = [
            pubsub.subscribe(ACTION_CHANGE_IMAGE_CNC, (msg, data) => {
                this.setState(data);
            })
        ];
    }

    componentWillUnmount() {
        this.subscriptions.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.subscriptions = [];
    }

    render() {
        const state = this.state;
        const actions = this.actions;

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
                                                <li><b>Outline</b>: {i18n._('Carve along the contour of the image.')}</li>
                                                <li><b>On the Path</b>: {i18n._('Carve along the shape of the image.')}</li>
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
                                                label: i18n._('Outline'),
                                                value: 'outline'
                                            },
                                            {
                                                label: i18n._('On the Path'),
                                                value: 'path'
                                            }
                                        ]}
                                        placeholder={i18n._('Choose carve path')}
                                        value={state.pathType}
                                        onChange={actions.onChangePathType}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Resolution')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Resolution')}
                                    content={i18n._('The detected resolution of the loaded image.')}
                                >
                                    <Input
                                        style={{ width: '45%' }}
                                        value={state.originWidth}
                                        disabled="disabled"
                                    />
                                    <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={state.originHeight}
                                        disabled="disabled"
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                {i18n._('Size (mm)')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Size')}
                                    content={i18n._('Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material.')}
                                >
                                    <Input
                                        style={{ width: '45%' }}
                                        value={state.sizeWidth}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={actions.onChangeWidth}
                                    />
                                    <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={state.sizeHeight}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={actions.onChangeHeight}
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
                                            value={state.targetDepth}
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
                                            value={state.stepDown}
                                            min={0.01}
                                            max={state.targetDepth}
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
                                            value={state.safetyHeight}
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
                                            value={state.stopHeight}
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
                            <td>
                                {i18n._('Alignment')}
                            </td>
                            <td>
                                <TipTrigger
                                    title={i18n._('Alignment')}
                                    content={i18n._('Alignment of generated G-code.')}
                                >
                                    <Select
                                        options={[{
                                            value: 'none',
                                            label: i18n._('None')
                                        }, {
                                            value: 'clip',
                                            label: i18n._('Clip to axes')
                                        }, {
                                            value: 'center',
                                            label: i18n._('Align center to origin')
                                        }]}
                                        value={state.alignment}
                                        searchable={false}
                                        clearable={false}
                                        backspaceRemoves={false}
                                        onChange={actions.onSelectAlignment}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <OptionalDropdown
                    title={i18n._('Tabs')}
                    titleWidth="60px"
                    onClick={actions.onToggleEnableTab}
                    hidden={!state.enableTab}
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
                                                value={state.tabHeight}
                                                min={-state.targetDepth}
                                                max={0}
                                                step={0.5}
                                                onChange={actions.onTabHeight}
                                                disabled={!state.enableTab}
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
                                                value={state.tabSpace}
                                                min={1}
                                                step={1}
                                                onChange={actions.onTabSpace}
                                                disabled={!state.enableTab}
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
                                                value={state.tabWidth}
                                                min={1}
                                                step={1}
                                                onChange={actions.onTabWidth}
                                                disabled={!state.enableTab}
                                            />
                                            <span className={styles['description-text']} style={{ margin: '8px 0 6px 4px' }}>mm</span>
                                        </div>
                                    </TipTrigger>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </OptionalDropdown>
                <button
                    type="button"
                    className={classNames(styles.btn, styles['btn-large-blue'])}
                    onClick={actions.onClickPreview}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    {i18n._('Preview')}
                </button>
            </React.Fragment>
        );
    }
}

export default PathParameters;
