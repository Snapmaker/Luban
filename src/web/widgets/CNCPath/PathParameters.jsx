import React, { PureComponent } from 'react';
import Select from 'react-select';
import { connect } from 'react-redux';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import {
    BOUND_SIZE
} from '../../constants';
import i18n from '../../lib/i18n';
import { toFixed } from '../../lib/numeric-utils';
import { NumberInput as Input } from '../../components/Input';
import Space from '../../components/Space';
import TipTrigger from '../../components/TipTrigger';
import OptionalDropdown from '../../components/OptionalDropdown/OptionalDropdown';
import { actions } from '../../reducers/modules/cnc';
import styles from '../styles.styl';


class PathParameters extends PureComponent {
    static propTypes = {
        // from redux
        pathParams: PropTypes.object.isRequired,
        imageParams: PropTypes.object.isRequired,
        changePathParams: PropTypes.func.isRequired,
        changeImageParams: PropTypes.func.isRequired,
        preview: PropTypes.func.isRequired
    };

    actions = {
        onChangePathType: (options) => {
            this.props.changePathParams({ pathType: options.value });
        },
        // carve width (in mm)
        onChangeWidth: (width) => {
            const ratio = this.props.imageParams.originHeight / this.props.imageParams.originWidth;
            const height = toFixed(width * ratio, 2);
            if (height < 1 || height > BOUND_SIZE) {
                return;
            }

            this.props.changeImageParams({
                sizeWidth: width,
                sizeHeight: height
            });
        },
        // carve height (in mm)
        onChangeHeight: (height) => {
            const ratio = this.props.imageParams.originHeight / this.props.imageParams.originWidth;
            const width = height / ratio;
            if (width <= 0 || width > BOUND_SIZE) {
                return;
            }

            this.props.changeImageParams({
                sizeWidth: width,
                sizeHeight: height
            });
        },
        onChangeTargetDepth: (targetDepth) => {
            if (targetDepth > BOUND_SIZE) {
                return;
            }
            this.props.changePathParams({ targetDepth: targetDepth });
            if (targetDepth < this.props.pathParams.stepDown) {
                this.props.changePathParams({ stepDown: targetDepth });
            }
            if (-targetDepth > this.props.pathParams.tabHeight) {
                this.props.changePathParams({ stepDown: -targetDepth });
            }
        },
        onChangeStepDown: (stepDown) => {
            this.props.changePathParams({ stepDown: stepDown });
        },
        onChangeSafetyHeight: (safetyHeight) => {
            this.props.changePathParams({ safetyHeight: safetyHeight });
        },
        onChangeStopHeight: (stopHeight) => {
            this.props.changePathParams({ stopHeight: stopHeight });
        },
        onSelectAnchor: (options) => {
            this.props.changePathParams({ anchor: options.value });
        },
        onToggleClip: () => {
            const clip = !this.props.pathParams.clip;
            this.props.changePathParams({ clip: clip });
        },
        onToggleEnableTab: () => {
            const enableTab = !this.props.pathParams.enableTab;
            this.props.changePathParams({ enableTab: enableTab });
        },
        onTabWidth: (tabWidth) => {
            this.props.changePathParams({ tabWidth: tabWidth });
        },
        onTabHeight: (tabHeight) => {
            this.props.changePathParams({ tabHeight: tabHeight });
        },
        onTabSpace: (tabSpace) => {
            this.props.changePathParams({ tabSpace: tabSpace });
        },
        onClickPreview: () => {
            this.props.preview();
        }
    };

    render() {
        const { pathParams, imageParams } = this.props;
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
                                                <li><b>{i18n._('Outline')}</b>: {i18n._('Carve along the contour of the image.')}</li>
                                                <li><b>{i18n._('On the Path')}</b>: {i18n._('Carve along the shape of the image.')}</li>
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
                                        value={pathParams.pathType}
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
                                        value={imageParams.originWidth}
                                        disabled="disabled"
                                    />
                                    <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={imageParams.originHeight}
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
                                        value={imageParams.sizeWidth}
                                        min={1}
                                        max={BOUND_SIZE}
                                        onChange={actions.onChangeWidth}
                                    />
                                    <span style={{ width: '10%', textAlign: 'center', display: 'inline-block' }}>X</span>
                                    <Input
                                        style={{ width: '45%' }}
                                        value={imageParams.sizeHeight}
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
                                            value={pathParams.targetDepth}
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
                                            value={pathParams.stepDown}
                                            min={0.01}
                                            max={pathParams.targetDepth}
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
                                            value={pathParams.safetyHeight}
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
                                            value={pathParams.stopHeight}
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
                                    defaultChecked={pathParams.clip}
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
                                        options={[{
                                            value: 'none',
                                            label: i18n._('None')
                                        }, {
                                            value: 'center',
                                            label: i18n._('Center')
                                        }]}
                                        value={pathParams.anchor}
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
                    hidden={!pathParams.enableTab}
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
                                                value={pathParams.tabHeight}
                                                min={-pathParams.targetDepth}
                                                max={0}
                                                step={0.5}
                                                onChange={actions.onTabHeight}
                                                disabled={!pathParams.enableTab}
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
                                                value={pathParams.tabSpace}
                                                min={1}
                                                step={1}
                                                onChange={actions.onTabSpace}
                                                disabled={!pathParams.enableTab}
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
                                                value={pathParams.tabWidth}
                                                min={1}
                                                step={1}
                                                onChange={actions.onTabWidth}
                                                disabled={!pathParams.enableTab}
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
                    className={classNames(styles['btn-large'], styles['btn-primary'])}
                    onClick={actions.onClickPreview}
                    style={{ display: 'block', width: '100%', marginTop: '15px' }}
                >
                    {i18n._('Next')}
                </button>
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        pathParams: state.cnc.pathParams,
        imageParams: state.cnc.imageParams
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changePathParams: (params) => dispatch(actions.changePathParams(params)),
        changeImageParams: (params) => dispatch(actions.changeImageParams(params)),
        preview: () => dispatch(actions.preview())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PathParameters);
