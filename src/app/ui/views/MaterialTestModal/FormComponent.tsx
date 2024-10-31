import React from 'react';
import { Row, Col, Form, InputNumber, Divider } from 'antd';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';
import SvgIcon from '../../components/SvgIcon';

const FormComponent: React.FC = () => {
    const speedFormItems = [
        { label: i18n._('key_ui-views-MaterialTestModal-FormComponent-rows'), component: <InputNumber className={styles.input} min={1} max={11} defaultValue={10} name="rectRows" /> },
        {
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-min'),
            component: (
                <>
                    <InputNumber controls={false} className={styles.input} min={0} name="speedMin" defaultValue={600} />
                    <span className={styles.suffix}>mm/min</span>
                </>
            )
        },
        {
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-max'),
            component: (
                <>
                    <InputNumber controls={false} className={styles.input} min={200} name="reftMax" defaultValue={18000} />
                    <span className={styles.suffix}>mm/min</span>
                </>
            )
        },
        {
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-height'),
            component: (
                <>
                    <InputNumber controls={false} className={styles.input} min={1} max={30} defaultValue={5} name="rectheight" />
                    <span className={styles.suffix}>mm</span>
                </>
            )
        },
    ];
    const powerFormItems = [
        { label: i18n._('key_ui-views-MaterialTestModal-FormComponent-columnCount'), component: <InputNumber className={styles.input} min={1} max={11} defaultValue={10} name="rectCols" /> },
        {
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-min'),
            component: (
                <>
                    <InputNumber controls={false} className={styles.input} max={100} min={0} defaultValue={10} name="powerMin" />
                    <span className={styles.suffix}>%</span>
                </>
            )
        },
        {
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-max'),
            component: (
                <>
                    <InputNumber controls={false} className={styles.input} max={100} min={1} defaultValue={100} name="powerMax" />
                    <span className={styles.suffix}>%</span>
                </>
            )
        },
        {
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-width'),
            component: (
                <>
                    <InputNumber controls={false} className={styles.input} max={30} min={1} defaultValue={5} name="rectWidth" />
                    <span className={styles.suffix}>mm</span>
                </>
            )
        },
    ];
    return (
        <>
            <Form id="formIDataBox" labelAlign="speed" labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
                <Row gutter={24}>
                    <Col span={12}>
                        <div className={styles['title-box']}>
                            <div>
                                <SvgIcon
                                    name="TitleSetting"
                                    type={['static']}
                                    size={24}
                                />
                                {i18n._('key_ui-views-MaterialTestModal-FormComponent-rows')}
                            </div>
                            <div className={styles['title-box-name']}>{i18n._('key_ui-views-MaterialTestModal-FormComponent-speed')}</div>
                        </div>
                        <Divider className={styles.divider} />
                        {speedFormItems.map((item) => (
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
                                {i18n._('key_ui-views-MaterialTestModal-FormComponent-columns')}
                            </div>
                            <div className={styles['title-box-name']}>{i18n._('key_ui-views-MaterialTestModal-FormComponent-power')}</div>
                        </div>
                        <Divider className={styles.divider} />
                        {powerFormItems.map((item) => (
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
