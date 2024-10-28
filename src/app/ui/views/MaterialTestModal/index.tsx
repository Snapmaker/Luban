import React, { useEffect, useState } from 'react';
import { Modal, Row, Col, Form, InputNumber, Divider } from 'antd';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { actions } from '../../../flux/editor';
import SvgIcon from '../../components/SvgIcon';

import ToolPathConfig from './ToolPathConfig';

import styles from './styles.styl';

interface MaterialTestModalProps {
    onClose: () => void;
}

const setAttributes = (element, attributes) => {
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
};
let svgContainer = null;
const leftFormItems = [
    {
        label: '参数',
        name: 'parameter',
        component: (
            <select className={`${styles.input} ${styles.select}`} defaultValue="速度" name="left_parameter">
                <option value="速度">速度</option>
            </select>
        )
    },
    { label: '行数', component: <InputNumber className={styles.input} min={1} max={11} defaultValue={1} name="leftRow" /> },
    {
        label: '最小值',
        component: (
            <>
                <InputNumber controls={false} className={styles.input} min={0} name="leftMin" defaultValue={600} />
                <span className={styles.suffix}>mm/min</span>
            </>
        )
    },
    {
        label: '最大值',
        component: (
            <>
                <InputNumber controls={false} className={styles.input} min={200} name="reftMax" defaultValue={18000} />
                <span className={styles.suffix}>mm/min</span>
            </>
        )
    },
    {
        label: '矩形高度',
        component: (
            <>
                <InputNumber controls={false} className={styles.input} min={1} max={30} defaultValue={5} name="leftRectHeight" />
                <span className={styles.suffix}>mm</span>
            </>
        )
    },
];
const rightFormItems = [
    {
        label: '参数',
        component: (
            <select className={`${styles.input} ${styles.select}`} defaultValue="功率" name="right_parameter">
                <option value="功率">功率</option>
            </select>
        )
    },
    { label: '列数', component: <InputNumber className={styles.input} min={1} max={11} defaultValue={1} name="rightCol" /> },
    {
        label: '最小值',
        component: (
            <>
                <InputNumber controls={false} className={styles.input} max={100} min={0} defaultValue={10} name="rightMin" />
                <span className={styles.suffix}>mm/min</span>
            </>
        )
    },
    {
        label: '最大值',
        component: (
            <>
                <InputNumber controls={false} className={styles.input} max={100} min={1} defaultValue={100} name="rightMax" />
                <span className={styles.suffix}>mm/min</span>
            </>
        )
    },
    {
        label: '矩形高度',
        component: (
            <>
                <InputNumber controls={false} className={styles.input} max={30} min={1} defaultValue={5} name="rightRectHeight" />
                <span className={styles.suffix}>mm</span>
            </>
        )
    },
];
const FormComponent = () => {
    return (
        <>
            <Form id="formIDataBox" labelAlign="left" labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
                <Row gutter={24}>
                    <Col span={12}>
                        <div>
                            <SvgIcon
                                name="TitleSetting"
                                type={['static']}
                                size={24}
                            />
                            行
                        </div>
                        <Divider className={styles.divider} />
                        {leftFormItems.map((item) => (
                            <Form.Item key={item.label} label={item.label} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        ))}
                    </Col>
                    <Col span={12}>
                        <div>
                            <SvgIcon
                                name="TitleSetting"
                                type={['static']}
                                size={24}
                            />
                            列
                        </div>
                        <Divider className={styles.divider} />
                        {rightFormItems.map((item) => (
                            <Form.Item key={item.label} label={item.label} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        ))}
                    </Col>
                </Row>
            </Form>
        </>
    );
};
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

export default function MaterialTest({ onClose }): React.ReactElement<MaterialTestModalProps> {
    const [visible, setVisible] = useState(true);
    const [saveToolPathFlag, setSaveToolPathFlag] = useState(false);

    const dispatch = useDispatch(); // 获取 dispatch
    const [editingToolpath, setEditingToolpath] = useState({ ...defaultPath });
    // const selectedToolPathIDArray = useSelector(state => state.laser?.toolPath?.getSelectedToolPathIDArray());
    // const selectedToolPathIDArray = useSelector(state => state[props.headType]?.toolPathGroup?.selectedToolPathArray, shallowEqual);
    const toolPaths = useSelector(state => state.laser?.toolPathGroup?.getToolPaths(), shallowEqual);

    const selectedModelArray = useSelector(state => state.laser?.modelGroup?.getSelectedModelArray());
    useEffect(() => {
        console.log('line:204 selectedModelArray::: ', selectedModelArray);
        if (selectedModelArray.length > 0) {
            const firstModel = selectedModelArray[0];
            console.log('line:206 firstModel::: ', firstModel);
            const toolpath = dispatch(actions.createToolPath('laser'));
            console.log('line:222 toolpath::: ', toolpath);
            setEditingToolpath(toolpath);
        }
    }, [selectedModelArray]);

    const handleClose = () => {
        console.log('line:160 handleClose::: ');
    };
    const handleCancel = () => {
        setVisible(false);
        onClose();
    };
    // 用于设置并生成svg的个数
    // 需要知道类型，以及svg的个数
    const svgNamespace = 'http://www.w3.org/2000/svg';

    const powX = 210;
    const powY = 475;
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

    const handleSubmit = () => {
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

    const onCreatText = async (text, x, y, needRote,) => {
        const textSvg = await dispatch(actions.createText('laser', text));
        const id = uniqueId();
        setAttributes(textSvg, { x: powX + x, y: powY + y, id: id });
        await dispatch(actions.createModelFromElement('laser', textSvg));
        if (needRote) {
            // 需要旋转的元素
            const textElement = document.getElementById(id);
            dispatch(actions.rotateElementsImmediately('laser', [textElement], { newAngle: -90 }));
        }
    };
    const selectAllElements = () => dispatch(actions.selectAllElements('laser'));
    const onSelectElements = (elements) => dispatch(actions.selectElements('laser', elements));

    const onCreateElement = async () => {
        // remove ToolPaths
        const toolPathIDArray = toolPaths.map(v => v.id);
        if (toolPathIDArray.length) dispatch(actions.deleteToolPath('laser', toolPathIDArray));

        await selectAllElements();
        console.log('line:276 selectedModelArray::: ', selectedModelArray);
        dispatch(actions.removeSelectedModel('laser'));
        // dispatch(actions.showModelGroupObject('laser'));

        if (!svgContainer) {
            svgContainer = document.createElementNS(svgNamespace, 'svg'); // 创建一个临时的 SVG 容器
            svgContainer.style.opacity = '0';
            svgContainer.id = 'svgContainer-box';
            document.body.appendChild(svgContainer);
        }
        // 根据行列最小值 最大值生成 rect
        const data: TypeDta = handleSubmit();
        console.log('line:212 data::: ', data);

        const gap = 5;
        const { leftRow, leftMin, reftMax, rightCol, rightMax, rightMin, leftRectHeight, rightRectHeight } = data;
        console.log('line:174 leftRow::: ', leftRow);
        console.log('line:174 leftRow::: ', typeof leftRow);
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
        await onCreatText('Pssses', rightCol / 2 * (gap + w), -leftRow * (gap + h) - 20, false);
        await onCreatText('Power(%)', rightCol / 2 * (gap + w) + 10, 6 * gap, false);
        await onCreatText('Speed(mm/m)', -8 * gap, -leftRow / 2 * (gap + h), true);

        // row * col create rect
        for (let i = 0; i < rightCol; i++) {
            if (i === 0) x = 2 * gap;
            else x += gap + w;
            await onCreatText(`${Math.round(rightMinNum + i * rex)}`, x + w / 2, 2 * gap, true);
            y = 0;
            for (let j = 0; j < leftRow; j++) {
                setSaveToolPathFlag(false);
                y -= gap + h;
                const rect = document.createElementNS(svgNamespace, 'rect');
                setAttributes(rect, attributeObj(`${uniqueId()}-${i}-${j}`, x, y, w, h));
                svgContainer.appendChild(rect);
                await dispatch(actions.createModelFromElement('laser', rect));
                onSelectElements([rect]);
                setSaveToolPathFlag(true);
                // add todo: create Path
                if (i === 0) await onCreatText(`${Math.round(leftMinNum + j * lex)}`, -2 * gap, y + h / 2, false);
            }
        }
        setSaveToolPathFlag(false);
        const AllRect = await selectAllElements();
        console.log('line:327 AllRect::: ', AllRect);
        setSaveToolPathFlag(true);
        await dispatch(actions.preview('laser'));
        console.log('completed');
        handleCancel();
    };
    const handleCreate = () => {
        // setVisible(false);
        // onClose();
        onCreateElement();
    };

    return (
        <div className={styles.container}>
            <Modal
                title="Material Test"
                open={visible}
                onOk={handleCreate}
                onCancel={handleCancel}
                width="540px"
            >
                <div className={styles['form-box']}>
                    <FormComponent />
                    {
                        editingToolpath && (
                            <ToolPathConfig
                                headType="laser"
                                toolpath={editingToolpath}
                                onClose={() => handleClose}
                                saveToolPathFlag={saveToolPathFlag}
                                noNeedName={Boolean(1)}
                            />
                        )
                    }
                </div>
            </Modal>
        </div>
    );
}
