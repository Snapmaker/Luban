import React, { useEffect, useState } from 'react';
import { Modal, Spin } from 'antd';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import log from '../../../lib/log';
import { actions } from '../../../flux/editor';
import { machineStore } from '../../../store/local-storage';

import ToolPathConfig from './ToolPathConfig';
import FormComponent from './FormComponent';
import styles from './styles.styl';

const setAttributes = (element, attributes) => {
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
};
let svgContainer = null;

const defaultPath = {
    'id': 'default',
    'headType': 'laser',
    'name': '矢量工具路径 - 1',
    'baseName': '',
    'type': 'vector',
    'useLegacyEngine': false,
    'status': 'warning',
    'check': true,
    'visible': true,
    'modelMap': {},
    'modelMode': 'vector',
    'visibleModelIDs': [
        'id-1730041940243-0-0'
    ],
    'toolPathFiles': [
        null
    ],
    'gcodeConfig': {
        'optimizePath': false,
        'movementMode': 'greyscale-line',
        'pathType': 'path',
        'fillInterval': 0.25,
        'jogSpeed': 3000,
        'workSpeed': 140,
        'plungeSpeed': 800,
        'dwellTime': 5,
        'fixedPowerEnabled': true,
        'fixedPower': 100,
        'multiPassEnabled': true,
        'multiPasses': 2,
        'initialHeightOffset': 0,
        'multiPassDepth': 0.6
    },
    'toolParams': {},
    'materials': {
        'isRotate': false,
        'diameter': 0,
        'x': 320,
        'y': 350
    }
};

interface MaterialTestModalProps {
    onClose: () => void;
}
export default function MaterialTest({ onClose }): React.ReactElement<MaterialTestModalProps> {
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(true);
    const [saveToolPathFlag, setSaveToolPathFlag] = useState(false);
    const [workSpeed, setWorkSpeed] = useState(140);
    const [fixedPower, setFixedPower] = useState(100);
    const dispatch = useDispatch();
    const [editingToolpath, setEditingToolpath] = useState({ ...defaultPath });
    const toolPaths = useSelector(state => state.laser?.toolPathGroup?.getToolPaths(), shallowEqual);

    const selectedModelArray = useSelector(state => state.laser?.modelGroup?.getSelectedModelArray());
    useEffect(() => {
        if (selectedModelArray.length > 0) {
            const toolpath = dispatch(actions.createToolPath('laser'));
            setEditingToolpath(toolpath);
        }
    }, [selectedModelArray]);

    const handleCancel = () => {
        setVisible(false);
        onClose();
    };

    const svgNamespace = 'http://www.w3.org/2000/svg';

    const powXCenter = 180;
    const powYCenter = 500;
    const originPosition = {
        'bottom-left': { powX: powXCenter + 160, powY: powXCenter + 100 },
        'bottom-right': { powX: powXCenter - 160, powY: powXCenter + 100 },
        'top-left': { powX: powXCenter + 160, powY: powXCenter + 450 },
        'top-right': { powX: powXCenter - 160, powY: powXCenter + 450 },
        'center': { powX: powXCenter, powY: powYCenter },
    };
    const originReference = machineStore.get('origin.reference');
    const { powX, powY } = originPosition[originReference];

    const attributeObj = (uniqueId, x, y, w, h) => {
        return {
            id: uniqueId,
            x: powX + x,
            y: powY + y,
            width: w,
            height: h,
            fill: '#ffffff',
            'fill-opacity': '0',
            opacity: '1',
            stroke: '#000000',
            'stroke-width': '0.2756410256410256',
        };
    };
    // Generate a unique ID
    const uniqueId = () => {
        return `id-${Date.now()}`;
    };

    const getFormData = () => {
        const formIDataBox = document.getElementById('formIDataBox') as HTMLFormElement;
        const formData = new FormData(formIDataBox);
        const dataObject = Object.fromEntries(formData.entries());
        return dataObject;
    };
    type TypeDta = {
        leftRow: number,
        leftMin: number,
        reftMax: number,
        rightCol: number,
        rightMax: number,
        rightMin: number,
        leftRectHeight: number,
        rightRectHeight: number,
    };
    const textRectArray = [];
    const onCreatText = async (text, x, y, w, h, needRote) => {
        const textSvg = await dispatch(actions.createText('laser', text));
        const id = uniqueId();
        const pox = powX + x;
        const poy = powY + y;
        setAttributes(textSvg, { id: id, x: pox, y: poy, width: w, height: h });
        await dispatch(actions.createModelFromElement('laser', textSvg));
        const textElement = document.getElementById(id);
        dispatch(actions.resizeElementsImmediately('laser', [textElement], { newHeight: h, newWidth: w }));
        textRectArray.push(textElement);
        if (needRote) {
            dispatch(actions.rotateElementsImmediately('laser', [textElement], { newAngle: -90 }));
        }
    };
    const selectAllElements = () => dispatch(actions.selectAllElements('laser'));
    const onSelectElements = (elements) => dispatch(actions.selectElements('laser', elements));
    const onClearSelection = () => dispatch(actions.clearSelection('laser'));
    const onCreateElement = async () => {
        textRectArray.splice(0);
        const toolPathIDArray = toolPaths.map(v => v.id);
        if (toolPathIDArray.length) {
            dispatch(actions.deleteToolPath('laser', toolPathIDArray));
        }
        await selectAllElements();
        dispatch(actions.removeSelectedModel('laser'));

        if (!svgContainer) {
            svgContainer = document.createElementNS(svgNamespace, 'svg');
            svgContainer.style.opacity = '0';
            svgContainer.id = 'svgContainer-box';
            document.body.appendChild(svgContainer);
        }
        const data: TypeDta = getFormData();
        const gap = 5;
        const { leftRow, leftMin, reftMax, rightCol, rightMax, rightMin, leftRectHeight, rightRectHeight } = data;
        // leftX = leftMin + i * lex
        const leftMinNum = Number(leftMin);
        const leftMaxNum = Number(reftMax);
        const lex = (leftMaxNum - leftMinNum) / ((leftRow - 1) || 1);

        const rightMinNum = Number(rightMin);
        const rightMaxNum = Number(rightMax);
        const rex = (rightMaxNum - rightMinNum) / ((rightCol - 1) || 1);

        let x = 0;
        let y = 0;
        const w = Number(rightRectHeight);
        const h = Number(leftRectHeight);
        await onCreatText('Passes', rightCol / 2 * (gap + w), -leftRow * (gap + h) - 20, 20, h, false);
        await onCreatText('Power(%)', rightCol / 2 * (gap + w) + 5, 10, 25, h, false);
        await onCreatText('Speed(mm/m)', -2 * gap, -leftRow / 2 * (gap + h), 30, h, true);
        // row * col create rect
        for (let i = 0; i < rightCol; i++) {
            x += gap + w;
            await onCreatText(`${Math.round(rightMinNum + i * rex)}`, x + 3, 0, h, w, true);
            y = 0;
            for (let j = 0; j < leftRow; j++) {
                setSaveToolPathFlag(false);
                y -= gap + h;
                const rect = document.createElementNS(svgNamespace, 'rect');
                setAttributes(rect, attributeObj(`${uniqueId()}-${i}-${j}`, x, y, w, h));
                svgContainer.appendChild(rect);
                await dispatch(actions.createModelFromElement('laser', rect));
                onSelectElements([rect]);
                setWorkSpeed(Math.round(leftMinNum + j * lex));
                setFixedPower(Math.round(rightMinNum + i * rex));
                setSaveToolPathFlag(true);
                onClearSelection();
                if (i === 0) await onCreatText(`${Math.round(leftMinNum + j * lex)}`, x - w, y + 3, w, h, false);
            }
        }
        setSaveToolPathFlag(false);
        onSelectElements(textRectArray);
        setWorkSpeed(defaultPath.gcodeConfig.workSpeed);
        setFixedPower(defaultPath.gcodeConfig.fixedPower);
        setSaveToolPathFlag(true);
        await dispatch(actions.preview('laser'));
        onClearSelection();
        handleCancel();
    };
    const handleCreate = () => {
        setLoading(true);
        onCreateElement();
    };
    const onComplated = () => {
        log.info('onComplated:');
    };

    return (
        <div className={styles.container}>
            <Modal
                title="Material Test"
                open={visible}
                onOk={handleCreate}
                onCancel={handleCancel}
                okButtonProps={{ disabled: loading }}
                cancelButtonProps={{ disabled: loading }}
                width="540px"
            >
                <Spin spinning={loading} tip="Loading...">
                    <div className={styles['form-box']}>
                        {/* <FormComponentt /> */}
                        <FormComponent />
                        {
                            editingToolpath && (
                                <ToolPathConfig
                                    headType="laser"
                                    toolpath={editingToolpath}
                                    onClose={onComplated}
                                    saveToolPathFlag={saveToolPathFlag}
                                    fixedPower={fixedPower}
                                    workSpeed={workSpeed}
                                />
                            )
                        }
                    </div>
                </Spin>
            </Modal>
        </div>
    );
}
