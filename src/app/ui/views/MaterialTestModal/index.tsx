import React, { useState } from 'react';
import { Modal, Row, Col, Form, InputNumber, Divider, Checkbox } from 'antd';
import { useDispatch } from 'react-redux';
import { actions } from '../../../flux/editor';

import styles from './styles.styl';

interface MaterialTestModalProps {
    onClose: () => void;
}

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
    { label: '行数', component: <InputNumber className={styles.input} min={1} max={11} defaultValue={10} name="leftRow" /> },
    { label: '最小值', component: <InputNumber className={styles.input} min={0} name="leftMin" defaultValue={600} /> },
    { label: '最大值', component: <InputNumber className={styles.input} min={200} name="rileftMax" defaultValue={18000} /> },
    { label: '矩形高度', component: <InputNumber className={styles.input} min={1} max={30} defaultValue={5} name="leftRectHeight" /> },
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
    { label: '列数', component: <InputNumber className={styles.input} min={1} max={11} defaultValue={10} name="rightCol" /> },
    { label: '最小值', component: <InputNumber className={styles.input} min={0} name="rightMin" defaultValue={10} /> },
    { label: '最大值', component: <InputNumber className={styles.input} max={100} defaultValue={100} name="rightMax" /> },
    { label: '矩形高度', component: <InputNumber className={styles.input} min={1} max={30} defaultValue={5} name="rightRectHeight" /> },
];

// 加工方法
const addFactoryItems = [
    {
        label: '加工方法',
        component: (
            <select className={`${styles.input} ${styles.select}`} defaultValue="填充" name="factory_method">
                <option value="填充">填充</option>
                <option value="恒功率模式">恒功率模式</option>
            </select>
        )
    },
    { label: '恒功率模式', component: <Checkbox name="constant_power_mode" /> },
];

// 填充
const fillItems = [
    {
        label: '移动模式',
        component: (
            <select className={`${styles.input} ${styles.select}`} defaultValue="线条" name="fill_mode">
                <option value="线条">线条</option>
                <option value="曲线">曲线</option>
            </select>
        )
    },

    { label: '填充间距', component: <InputNumber className={styles.input} name="optimize_rect_gap" /> },

    {
        label: '线条方向',
        component: (
            <select className={`${styles.input} ${styles.select}`} defaultValue="水平" name="line_direct">
                <option value="水平">水平</option>
                <option value="垂直">垂直</option>
            </select>
        )
    },
];

// 优化
const optimizeItems = [
    { label: 'Dot width compensation', component: <InputNumber className={styles.input} name="dot_width_compensation" /> },
    { label: 'Scan Offset', component: <InputNumber className={styles.input} name="scan_offset" /> },
    { label: 'Over Scanning', component: <InputNumber className={styles.input} name="over_scanning" /> },
    { label: 'Air Assist Pump', component: <Checkbox className={styles.input} name="air_assist_pump" /> },
];

const DesignForm = () => {
    return (
        <div className={styles['form-box']}>
            <Form id="formIDataBox" labelAlign="left" labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
                <Row gutter={24}>
                    <Col span={12}>
                        <div>行</div>
                        <Divider className={styles.divider} />
                        {leftFormItems.map((item) => (
                            <Form.Item key={item.label} label={item.label} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        ))}
                    </Col>
                    <Col span={12}>
                        <div>列</div>
                        <Divider className={styles.divider} />
                        {rightFormItems.map((item) => (
                            <Form.Item key={item.label} label={item.label} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        ))}
                    </Col>
                </Row>

                <Row>
                    <div>加工方法</div>
                    <Divider className={styles.divider} />
                    {addFactoryItems.map((item) => (
                        <Col key={`addFactory-${item.label}`} span={12}>
                            <Form.Item key={item.label} label={item.label} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        </Col>
                    ))}
                </Row>

                <Row>
                    <div>填充</div>
                    <Divider className={styles.divider} />
                    {fillItems.map((item) => (
                        <Col key={`fill-${item.label}`} span={12}>
                            <Form.Item key={item.label} label={item.label} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        </Col>
                    ))}
                </Row>

                <Row>
                    <div>优化</div>
                    <Divider className={styles.divider} />
                    {optimizeItems.map((item) => (
                        <Col key={`optimize-${item.label}`} span={12}>
                            <Form.Item key={item.label} label={item.label} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        </Col>
                    ))}
                </Row>
            </Form>
        </div>
    );
};

const setAttributes = (element, attributes) => {
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
};
let svgContainer = null;

export default function MaterialTest({ onClose }): React.ReactElement<MaterialTestModalProps> {
    const [visible, setVisible] = useState(true);
    // const [leftParameter, setLeftParameter] = useState("速度");
    // const [rightParameter, setRightParameter] = useState("速度");
    const dispatch = useDispatch(); // 获取 dispatch

    // 用于设置并生成svg的个数
    // 需要知道类型，以及svg的个数
    const svgNamespace = 'http://www.w3.org/2000/svg';

    const powX = 210;
    const powY = 475;
    const attributeObj = (uniqueId, x, y, w, h, text?: string) => {
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
            text: text,
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
        rileftMax: number,
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

    const onCreateElement = async () => {
        dispatch(actions.selectAllElements('laser'));
        dispatch(actions.removeSelectedModel('laser'));
        // const svgContainer = document.createElement('div');
        // svgContainer.id = 'svgContainer';
        // document.body.appendChild(svgContainer);
        if (!svgContainer) svgContainer = document.createElementNS(svgNamespace, 'svg'); // 创建一个临时的 SVG 容器
        svgContainer.style.opacity = '0';
        svgContainer.id = 'svgContainer-box';
        // 根据行列最小值 最大值生成 rect
        const data: TypeDta = handleSubmit();
        console.log('line:212 data::: ', data);
        const gap = 5;
        const { leftRow, leftMin, rileftMax, rightCol, rightMax, rightMin, leftRectHeight, rightRectHeight } = data;
        // leftX = leftMin + i * lex
        const leftMinNum = Number(leftMin);
        const leftMaxNum = Number(rileftMax);
        const lex = (leftMaxNum - leftMinNum) / ((leftRow - 1) || 1);

        const rightMinNum = Number(rightMin);
        const rightMaxNum = Number(rightMax);
        const rex = (rightMaxNum - rightMinNum) / ((rightCol - 1) || 1);

        let x = 0;
        let y = 0;
        const w = Number(rightRectHeight);
        const h = Number(leftRectHeight);
        await onCreatText('Pssses', rightCol / 2 * (gap + w), -leftRow * (gap + h) - 20, false);
        await onCreatText('Power(%)', rightCol / 2 * (gap + w) + 10, 8 * gap, false);
        await onCreatText('Speed(mm/m)', -8 * gap, -leftRow / 2 * (gap + h), true);

        // row * col create rect
        for (let i = 0; i < rightCol; i++) {
            // x += gap + w;
            if (i === 0) x = 2 * gap;
            else x += gap + w;
            await onCreatText(`${(rightMinNum + i * rex).toFixed(1)}`, x + w / 2, 3 * gap, true);

            y = 0;
            for (let j = 0; j < leftRow; j++) {
                y -= gap + h;
                const rect = document.createElementNS(svgNamespace, 'rect');
                setAttributes(rect, attributeObj(`${uniqueId()}-${i}-${j}`, x, y, w, h));
                console.log('line:263 svgContainer::: ', svgContainer);
                svgContainer.appendChild(rect);
                document.body.appendChild(svgContainer);
                await dispatch(actions.createModelFromElement('laser', rect));
                if (i === 0) await onCreatText(`${Math.round(leftMinNum + j * lex)}`, -2 * gap, y + h / 2, false);
            }
        }
    };
    const handleOk = () => {
        setVisible(false);
        onClose();
        onCreateElement();
    };

    const handleCancel = () => {
        setVisible(false);
        onClose();
    };
    return (
        <div className={styles.container}>
            <Modal
                title="Material Test"
                open={visible}
                onOk={handleOk}
                onCancel={handleCancel}
                width="500px"
            >
                <DesignForm />
            </Modal>
        </div>
    );
}
