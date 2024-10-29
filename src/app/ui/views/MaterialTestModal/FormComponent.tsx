import React from 'react';
import { Row, Col, Form, InputNumber, Divider } from 'antd';
import styles from './styles.styl';
// import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';

const FormComponent: React.FC = () => {
    const leftFormItems = [
        { label: '行数', component: <InputNumber className={styles.input} min={1} max={11} defaultValue={10} name="leftRow" /> },
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
        { label: '列数', component: <InputNumber className={styles.input} min={1} max={11} defaultValue={10} name="rightCol" /> },
        {
            label: '最小值',
            component: (
                <>
                    <InputNumber controls={false} className={styles.input} max={100} min={0} defaultValue={10} name="rightMin" />
                    <span className={styles.suffix}>%</span>
                </>
            )
        },
        {
            label: '最大值',
            component: (
                <>
                    <InputNumber controls={false} className={styles.input} max={100} min={1} defaultValue={100} name="rightMax" />
                    <span className={styles.suffix}>%</span>
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
    return (
        <>
            <Form id="formIDataBox" labelAlign="left" labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
                <Row gutter={24}>
                    <Col span={12}>
                        <div className={styles['title-box']}>
                            <div>
                                <SvgIcon
                                    name="TitleSetting"
                                    type={['static']}
                                    size={24}
                                />
                                行
                            </div>
                            <div className={styles['title-box-name']}>速度</div>
                        </div>
                        <Divider className={styles.divider} />
                        {leftFormItems.map((item) => (
                            <Form.Item key={item.label} label={<span className={styles['input-label']}>{item.label}</span>} colon={false} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        ))}
                    </Col>
                    <Col span={12}>
                        <div className={styles['title-box']}>
                            <div>
                                <SvgIcon
                                    name="TitleSetting"
                                    type={['static']}
                                    size={24}
                                />
                                列
                            </div>
                            <div className={styles['title-box-name']}>功率</div>
                        </div>
                        <Divider className={styles.divider} />
                        {rightFormItems.map((item) => (
                            <Form.Item key={item.label} label={<span className={styles['input-label']}>{item.label}</span>} colon={false} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        ))}
                    </Col>
                </Row>
            </Form>
        </>
    );
};

export default FormComponent;
