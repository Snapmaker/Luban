import classNames from 'classnames';
import React, { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { Slider } from 'antd';
import type { RootState } from '../../../flux/index.def';
import { actions as editorActions } from '../../../flux/editor';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import { SVGClippingOperation, SVGClippingType } from '../../../constants/clipping';
import Anchor from '../../components/Anchor';
import SvgIcon from '../../components/SvgIcon';
import { Button } from '../../components/Buttons';
import Select from '../../components/Select';
import { NumberInput as Input } from '../../components/Input';

interface SVGClippingOverlayProps {
    onClose: () => void;
}

const getSVGClippingOptions = (length, operation, noVectorLen) => {
    const svgClippingMap = {
        [SVGClippingType.Offset]: {
            label: i18n._('key-SVGClipping/Offset'),
            value: SVGClippingType.Offset,
            iconName: 'ToolOffset',
            disabled: noVectorLen > 0 || length === 0
        },
        [SVGClippingType.Background]: {
            label: i18n._('key-SVGClipping/Background'),
            value: SVGClippingType.Background,
            iconName: 'ToolBackground',
            disabled: noVectorLen > 0 || length === 0
        },
        [SVGClippingType.Ringing]: {
            label: i18n._('key-SVGClipping/Ringing'),
            value: SVGClippingType.Ringing,
            iconName: 'ToolRinging',
            disabled: noVectorLen > 0 || length === 0
        },
        [SVGClippingType.Union]: {
            label: i18n._('key-SVGClipping/Union'),
            value: SVGClippingType.Union,
            iconName: 'ToolUnion',
            disabled: noVectorLen > 0 || length === 0 || (length === 1 && operation === SVGClippingOperation.Merged)
        },
        [SVGClippingType.Clip]: {
            label: i18n._('key-SVGClipping/Clip'),
            value: SVGClippingType.Clip,
            iconName: 'ToolClip',
            disabled: noVectorLen > 0 || length !== 2
        }
    };
    const svgClippingOptions = [];
    for (const key of Object.keys(svgClippingMap)) {
        svgClippingOptions.push(svgClippingMap[key]);
    }
    return svgClippingOptions;
};

/**
 * Note that here we re-use Support Brush to add marks to mesh, so
 * function names are inconsistent with their actual purpose.
 */
const SVGClippingOverlay: React.FC<SVGClippingOverlayProps> = ({ onClose }) => {
    const dispatch = useDispatch();

    /**
     * Brush Type
     */
    const { svgClipping, modelGroup } = useSelector((state: RootState) => state.laser);

    const onChangeSVGClippingType = (type) => {
        dispatch(editorActions.updateSVGClipping('laser', {
            type
        }));
    };

    const onChangeSVGClippingOffset = (offset) => {
        dispatch(editorActions.updateSVGClipping('laser', {
            offset
        }));
    };

    const onChangeSVGClippingOperation = (operation) => {
        dispatch(editorActions.updateSVGClipping('laser', {
            operation
        }));
    };

    /**
     * Confirm changes.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onApply = useCallback(() => {
        dispatch(editorActions.clippingSelectedSVGModel('laser', svgClipping));
    }, [dispatch, svgClipping]);

    const selectedModels = modelGroup.getSelectedModelArray();
    const noVectorLen = selectedModels.filter(v => v.mode !== 'vector').length;
    const svgClippingOptions = useMemo(() => getSVGClippingOptions(selectedModels.length, svgClipping.operation, noVectorLen),
        [selectedModels.length, svgClipping.operation, noVectorLen]);
    const applyDisabled = svgClippingOptions.filter(v => v.value === svgClipping.type)[0].disabled;
    const isDistance = [SVGClippingType.Offset, SVGClippingType.Background, SVGClippingType.Ringing].includes(svgClipping.type);
    const isOperation = [SVGClippingType.Union].includes(svgClipping.type);
    const operationOptions = [
        {
            value: SVGClippingOperation.Separate,
            label: i18n._('Separate')
        },
        {
            value: SVGClippingOperation.Merged,
            label: i18n._('Merged')
        }
    ];

    return (
        <div className="position-absolute width-532 margin-left-72 border-default-grey-1 border-radius-8 background-color-white">
            <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-8 padding-horizontal-16')}>
                {i18n._('key-CncLaser/MainToolBar-Vector Tool')}
            </div>
            <div className="sm-flex justify-space-between padding-vertical-16 padding-horizontal-16">
                {
                    svgClippingOptions && svgClippingOptions.map(SVGClippingOption => {
                        const isSelected = svgClipping.type === SVGClippingOption.value;

                        return (
                            <Anchor
                                key={SVGClippingOption.value}
                                onClick={() => onChangeSVGClippingType(SVGClippingOption.value)}
                            >
                                <div
                                    className={classNames('width-88  border-radius-8 border-default-grey-1', {
                                        'border-color-blue-2': isSelected
                                    })}
                                >
                                    <div className={classNames('margin-top-16 margin-bottom-8 align-c width-percent-100')}>
                                        <SvgIcon
                                            name={SVGClippingOption.iconName}
                                            type={['static']}
                                            size={24}
                                            hoversize={24}
                                            color={isSelected ? '#1890FF' : '#85888C'}
                                        />
                                    </div>
                                    <div
                                        className={classNames('margin-vertical-8 align-c', {
                                            'color-blue-2': isSelected,
                                            'color-black-3': !isSelected,
                                        })}
                                    >
                                        {SVGClippingOption.label}
                                    </div>
                                </div>
                            </Anchor>
                        );
                    })
                }
            </div>
            {isDistance && (
                <div className="padding-horizontal-16">
                    <div className="sm-flex justify-space-between padding-top-8 padding-bottom-20">
                        <div>{i18n._('key-CncLaser/MainToolBar-Distance')}</div>
                        <Slider
                            min={0}
                            max={100}
                            value={svgClipping.offset}
                            onChange={onChangeSVGClippingOffset}
                            style={{
                                width: 240,
                                marginLeft: 8,
                                marginRight: 0
                            }}
                        />
                        <Input
                            suffix="mm"
                            size="small"
                            value={svgClipping.offset}
                            onChange={onChangeSVGClippingOffset}
                            min={0}
                            max={100}
                            decimalPlaces={0}
                        />
                    </div>
                </div>
            )}
            {isOperation && (
                <div className="padding-horizontal-16">
                    <div className="sm-flex justify-space-between padding-top-8 padding-bottom-20">
                        <span>{i18n._('key-CncLaser/MainToolBar-Operation')}</span>
                        <Select
                            className="height-32"
                            value={svgClipping.operation}
                            options={operationOptions}
                            onChange={(option) => { onChangeSVGClippingOperation(option.value); }}
                            size="96px"
                        />
                    </div>
                </div>
            )}
            <div className="background-grey-3 padding-vertical-8 sm-flex padding-horizontal-16 justify-space-between border-radius-bottom-8">
                <Button
                    onClick={onClose}
                    priority="level-two"
                    width="96px"
                    type="default"
                >
                    {i18n._('key-Modal/Common-Cancel')}
                </Button>
                <Button
                    priority="level-two"
                    width="96px"
                    type="primary"
                    onClick={onApply}
                    disabled={applyDisabled}
                >
                    {i18n._('key-Laser/CameraCapture-Apply')}
                </Button>
            </div>
        </div>
    );
};

export default SVGClippingOverlay;
