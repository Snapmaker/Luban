import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import { toFixed } from '../../../lib/numeric-utils';
import styles from './styles.styl';
import { actions as editorActions } from '../../../flux/editor';
import {
    COORDINATE_MODE_CENTER, COORDINATE_MODE_BOTTOM_LEFT, COORDINATE_MODE_BOTTOM_RIGHT, COORDINATE_MODE_TOP_LEFT,
    COORDINATE_MODE_TOP_RIGHT, COORDINATE_MODE_BOTTOM_CENTER, HEAD_CNC, HEAD_LASER, PAGE_EDITOR
} from '../../../constants';
import { NumberInput as Input } from '../../components/Input';
import Select from '../../components/Select';

class JobType extends PureComponent {
    static propTypes = {
        widgetActions: PropTypes.object.isRequired,
        headType: PropTypes.string.isRequired,

        page: PropTypes.string.isRequired,

        size: PropTypes.object.isRequired,
        coordinateMode: PropTypes.object.isRequired,
        coordinateSize: PropTypes.object.isRequired,

        materials: PropTypes.object.isRequired,

        updateMaterials: PropTypes.func.isRequired,

        use4Axis: PropTypes.bool.isRequired,

        changeCoordinateMode: PropTypes.func.isRequired
    };

    coordinateModeList = [
        {
            label: COORDINATE_MODE_CENTER.value,
            value: i18n._(COORDINATE_MODE_CENTER.label),
            mode: COORDINATE_MODE_CENTER
        },
        {
            label: COORDINATE_MODE_BOTTOM_LEFT.value,
            value: i18n._(COORDINATE_MODE_BOTTOM_LEFT.label),
            mode: COORDINATE_MODE_BOTTOM_LEFT
        },
        {
            label: COORDINATE_MODE_BOTTOM_RIGHT.value,
            value: i18n._(COORDINATE_MODE_BOTTOM_RIGHT.label),
            mode: COORDINATE_MODE_BOTTOM_RIGHT
        },
        {
            label: COORDINATE_MODE_TOP_LEFT.value,
            value: i18n._(COORDINATE_MODE_TOP_LEFT.label),
            mode: COORDINATE_MODE_TOP_LEFT
        },
        {
            label: COORDINATE_MODE_TOP_RIGHT.value,
            value: i18n._(COORDINATE_MODE_TOP_RIGHT.label),
            mode: COORDINATE_MODE_TOP_RIGHT
        }
    ];

    state = {
    };

    actions = {
        changeCoordinateMode: (option) => {
            const newCoordinateMode = this.coordinateModeList.find(d => d.value === option.value);
            this.props.changeCoordinateMode(newCoordinateMode.mode);
        }
    };

    constructor(props) {
        super(props);
        this.props.widgetActions.setTitle(i18n._('Job Type'));
        this.props.widgetActions.setDisplay(this.props.use4Axis && this.props.page === PAGE_EDITOR);
    }

    componentWillReceiveProps(nextProps) {
        this.props.widgetActions.setDisplay(nextProps.use4Axis && nextProps.page === PAGE_EDITOR);
    }

    render() {
        const { size, materials, headType, coordinateMode, coordinateSize } = this.props;
        const { isRotate, diameter, length } = materials;

        return (
            <React.Fragment>
                {!isRotate && (
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label">{i18n._('Origin Mode')}</span>
                        <Select
                            className="sm-parameter-row__font-select"
                            backspaceRemoves={false}
                            clearable={false}
                            options={this.coordinateModeList}
                            isGroup={false}
                            placeholder={i18n._('Choose font')}
                            value={i18n._(coordinateMode.label ?? COORDINATE_MODE_CENTER.label)}
                            onChange={this.actions.changeCoordinateMode}
                        />
                    </div>
                )}
                <div className="">
                    <div className="sm-tabs" style={{ marginBottom: '1rem' }}>
                        <button
                            type="button"
                            style={{ width: '50%' }}
                            className={classNames('sm-tab', { 'sm-selected': !isRotate })}
                            onClick={() => {
                                this.props.changeCoordinateMode(
                                    COORDINATE_MODE_CENTER
                                );
                                this.props.updateMaterials({ isRotate: false });
                            }}
                        >
                            {i18n._('3-axis')}
                        </button>
                        <button
                            type="button"
                            style={{ width: '50%' }}
                            className={classNames('sm-tab', { 'sm-selected': isRotate })}
                            onClick={() => {
                                this.props.changeCoordinateMode(
                                    COORDINATE_MODE_BOTTOM_CENTER, {
                                        x: diameter * Math.PI,
                                        y: length
                                    }
                                );
                                this.props.updateMaterials({ isRotate: true });
                            }}
                        >
                            {i18n._('4-axis')}
                        </button>
                    </div>
                </div>
                {!isRotate && (
                    <div>
                        <img
                            draggable="false"
                            style={{
                                margin: '8px 0px 0px 0px',
                                width: '316px'
                            }}
                            src="/resources/images/cnc-laser/3axis.png"
                            role="presentation"
                            alt="3 Axis"
                        />
                        <div style={{
                            marginTop: '16px'
                        }}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Height (mm)')}</span>
                                <Input
                                    disabled={false}
                                    className={styles['input-box-left']}
                                    value={toFixed(coordinateSize.y, 1)}
                                    max={size.y}
                                    min={10}
                                    onChange={(value) => {
                                        this.props.changeCoordinateMode(
                                            coordinateMode, {
                                                x: coordinateSize.x,
                                                y: value
                                            }
                                        );
                                    }}
                                />
                                <span
                                    className={styles['input-box-inner-text']}
                                >
                                    W
                                </span>
                            </div>
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Width (mm)')}</span>
                                <Input
                                    disabled={false}
                                    className={styles['input-box-left']}
                                    value={toFixed(coordinateSize.x, 1)}
                                    max={size.x}
                                    min={2}
                                    onChange={(value) => {
                                        this.props.changeCoordinateMode(
                                            coordinateMode, {
                                                x: value,
                                                y: coordinateSize.y
                                            }
                                        );
                                    }}
                                />
                                <span
                                    className={styles['input-box-inner-text']}
                                >
                                    H
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                {isRotate && (
                    <div>
                        {headType === HEAD_CNC && (
                            <img
                                draggable="false"
                                style={{
                                    margin: '8px 0px 0px 0px',
                                    width: '316px'
                                }}
                                src="/resources/images/cnc-laser/cnc-4axis.png"
                                role="presentation"
                                alt="4 Axis"
                            />
                        )}
                        {headType === HEAD_LASER && (
                            <img
                                draggable="false"
                                style={{
                                    margin: '8px 0px 0px 0px',
                                    width: '316px'
                                }}
                                src="/resources/images/cnc-laser/laser-4axis.png"
                                role="presentation"
                                alt="4 Axis"
                            />
                        )}
                        <div style={{
                            marginTop: '16px'
                        }}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Length (mm)')}</span>
                                <Input
                                    disabled={false}
                                    className={styles['input-box-left']}
                                    value={toFixed(length, 1)}
                                    max={size.y}
                                    min={10}
                                    onChange={(value) => {
                                        this.props.changeCoordinateMode(
                                            COORDINATE_MODE_BOTTOM_CENTER, {
                                                x: diameter * Math.PI,
                                                y: value
                                            }
                                        );
                                        this.props.updateMaterials({ length: value });
                                    }}
                                />
                                <span
                                    className={styles['input-box-inner-text']}
                                >
                                    L
                                </span>
                            </div>
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Diameter (mm)')}</span>
                                <Input
                                    disabled={false}
                                    className={styles['input-box-left']}
                                    value={toFixed(diameter, 1)}
                                    max={size.x}
                                    min={2}
                                    onChange={(value) => {
                                        this.props.changeCoordinateMode(
                                            COORDINATE_MODE_BOTTOM_CENTER, {
                                                x: value * Math.PI,
                                                y: length
                                            }
                                        );
                                        this.props.updateMaterials({ diameter: value });
                                    }}
                                />
                                <span
                                    className={styles['input-box-inner-text']}
                                >
                                    D
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { headType } = ownProps;
    const { size, use4Axis } = state.machine;
    const { page, materials, coordinateMode, coordinateSize } = state[headType];

    return {
        size,
        coordinateMode,
        coordinateSize,
        page,
        materials,
        use4Axis
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    const { headType } = ownProps;

    return {
        updateMaterials: (materials) => dispatch(editorActions.updateMaterials(headType, materials)),
        changeCoordinateMode: (coordinateMode, coordinateSize) => dispatch(editorActions.changeCoordinateMode(headType, coordinateMode, coordinateSize))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(JobType);
