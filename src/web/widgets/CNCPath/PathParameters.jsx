import React, { PureComponent } from 'react';
import Select from 'react-select';
import pubsub from 'pubsub-js';
import {
    BOUND_SIZE,
    DEFAULT_SIZE_WIDTH,
    DEFAULT_SIZE_HEIGHT,
    STAGE_IMAGE_LOADED,
    ACTION_REQ_PREVIEW_CNC,
    ACTION_CHANGE_IMAGE_CNC,
    ACTION_CHANGE_PATH,
    ACTION_CHANGE_STAGE_CNC
} from '../../constants';
import { toFixed } from '../../lib/numeric-utils';
import { InputWithValidation as Input } from '../../components/Input';
import TipTrigger from '../../components/TipTrigger';
import styles from './styles.styl';


class PathParameters extends PureComponent {
    state = {
        stage: STAGE_IMAGE_LOADED,
        originWidth: DEFAULT_SIZE_WIDTH,
        originHeight: DEFAULT_SIZE_HEIGHT,
        sizeWidth: DEFAULT_SIZE_WIDTH / 10,
        sizeHeight: DEFAULT_SIZE_HEIGHT / 10,

        pathType: 'outline', // default
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
                return false;
            }

            this.update({
                sizeWidth: width,
                sizeHeight: height
            });
            return true;
        },
        // carve height (in mm)
        onChangeHeight: (height) => {
            const ratio = this.state.originHeight / this.state.originWidth;
            const width = height / ratio;
            if (width <= 0 || width > BOUND_SIZE) {
                return false;
            }

            this.update({
                sizeWidth: width,
                sizeHeight: height
            });
            return true;
        },
        onChangeTargetDepth: (targetDepth) => {
            // TODO: update targetDepth to the height of material (if we can set material parameters)
            if (targetDepth > BOUND_SIZE) {
                return false;
            }
            this.update({ targetDepth });
            // TODO: use subscription pattern on changes of dependencies
            if (targetDepth < this.state.stepDown) {
                this.update({ stepDown: targetDepth });
            }
            if (-targetDepth > this.state.tabHeight) {
                this.update({ tabHeight: -targetDepth });
            }
            return true;
        },
        onChangeStepDown: (stepDown) => {
            this.update({ stepDown });
            return true;
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.update({ safetyHeight });
            return true;
        },
        onChangeStopHeight: (stopHeight) => {
            this.update({ stopHeight });
            return true;
        },
        onSelectAlignment: (options) => {
            this.update({ alignment: options.value });
        },
        onToggleEnableTab: (event) => {
            this.update({ enableTab: event.target.checked });
        },
        onTabHeight: (tabHeight) => {
            this.update({ tabHeight });
            return true;
        },
        onTabSpace: (tabSpace) => {
            this.update({ tabSpace });
            return true;
        },
        onTabWidth: (tabWidth) => {
            this.update({ tabWidth });
            return true;
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
            }),
            pubsub.subscribe(ACTION_CHANGE_STAGE_CNC, (msg, data) => {
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
                <table className={styles.parameterTable}>
                    <tbody>
                        <tr>
                            <td>Carve Path</td>
                            <td>
                                <TipTrigger
                                    title="Carve Path"
                                    content={(
                                        <div>
                                            <p>Select a carve path:</p>
                                            <ul>
                                                <li><b>Outline</b>: Carve along the contour of the image.</li>
                                                <li><b>On the Path</b>: Carve along the shape of the image.</li>
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
                                                label: 'Outline',
                                                value: 'outline'
                                            },
                                            {
                                                label: 'On the Path',
                                                value: 'path'
                                            }
                                        ]}
                                        placeholder="Choose Carve Path"
                                        value={state.pathType}
                                        onChange={actions.onChangePathType}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Resolution
                            </td>
                            <td>
                                <TipTrigger title="Resolution" content="The detected resolution of the loaded image.">
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
                                Size (mm)
                            </td>
                            <td>
                                <TipTrigger
                                    title="Size"
                                    content="Enter the size of the engraved picture. The size cannot be larger than 125 x 125 mm or the size of your material."
                                >
                                    <Input
                                        style={{ width: '45%' }}
                                        value={state.sizeWidth}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={actions.onChangeWidth}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                    <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={state.sizeHeight}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={actions.onChangeHeight}
                                        disabled={state.stage < STAGE_IMAGE_LOADED}
                                    />
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Target Depth
                            </td>
                            <td>
                                <TipTrigger title="Target Depth" content="Enter the depth of the carved image. The depth cannot be deeper than the flute length.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.targetDepth}
                                            min={0.01}
                                            max={BOUND_SIZE}
                                            step={0.1}
                                            onChange={actions.onChangeTargetDepth}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Step Down
                            </td>
                            <td>
                                <TipTrigger title="Step Down" content="Enter the depth of each carving step.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.stepDown}
                                            min={0.01}
                                            max={state.targetDepth}
                                            step={0.1}
                                            onChange={actions.onChangeStepDown}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Jog Height
                            </td>
                            <td>
                                <TipTrigger title="Jog Height" content="The distance between the tool and the material when it’s not carving.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.safetyHeight}
                                            min={0.1}
                                            max={BOUND_SIZE}
                                            step={1}
                                            onChange={actions.onChangeSafetyHeight}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Stop Height
                            </td>
                            <td>
                                <TipTrigger title="Stop Height" content="The distance between the tool and the material when the machine stops.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.stopHeight}
                                            min={0.1}
                                            max={BOUND_SIZE}
                                            step={1}
                                            onChange={actions.onChangeStopHeight}
                                            disabled={state.stage < STAGE_IMAGE_LOADED}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Alignment
                            </td>
                            <td>
                                <TipTrigger title="Alignment" content="Alignment of generated G-code.">
                                    <Select
                                        options={[{
                                            value: 'none',
                                            label: 'None'
                                        }, {
                                            value: 'clip',
                                            label: 'Clip to axes'
                                        }, {
                                            value: 'center',
                                            label: 'Align center to origin'
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
                        <tr>
                            <td />
                            <td>
                                <TipTrigger title="Tab" content="Tabs help to hold the part when cutting the stock along the contour.">
                                    <input type="checkbox" defaultChecked={state.enableTab} onChange={actions.onToggleEnableTab} /> <span>Tabs</span>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Tab Height
                            </td>
                            <td>
                                <TipTrigger title="Tab Height" content="Enter the height of the tabs.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.tabHeight}
                                            min={-state.targetDepth}
                                            max={0}
                                            step={0.5}
                                            onChange={actions.onTabHeight}
                                            disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Tab Space
                            </td>
                            <td>
                                <TipTrigger title="Tab Space" content="Enter the space between any two tabs.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.tabSpace}
                                            min={1}
                                            step={1}
                                            onChange={actions.onTabSpace}
                                            disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Tab Width
                            </td>
                            <td>
                                <TipTrigger title="Tab Width" content="Enter the width of the tabs.">
                                    <div className="input-group input-group-sm" style={{ width: '100%', zIndex: '0' }}>
                                        <Input
                                            value={state.tabWidth}
                                            min={1}
                                            step={1}
                                            onChange={actions.onTabWidth}
                                            disabled={state.stage < STAGE_IMAGE_LOADED || !state.enableTab}
                                        />
                                        <span className="input-group-addon" style={{ width: '85px', textAlign: 'right' }}>mm</span>
                                    </div>
                                </TipTrigger>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button
                    type="button"
                    className="btn btn-default"
                    onClick={actions.onClickPreview}
                    disabled={state.stage < STAGE_IMAGE_LOADED}
                    style={{
                        display: 'block',
                        width: '100%',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        marginTop: '10px',
                        marginBottom: '10px'
                    }}
                >
                    Preview
                </button>
            </React.Fragment>
        );
    }
}

export default PathParameters;
