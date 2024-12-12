// import { Machine } from '@snapmaker/luban-platform';
// import { includes } from 'lodash';
// import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import React, { useImperativeHandle, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Row, Col, Form, InputNumber, Divider } from 'antd';
import styles from './FormStyles.styl';
import SvgIcon from '../../components/SvgIcon';

import {
    HEAD_LASER
} from '../../../constants';
import { editorStore } from '../../../store/local-storage';
import { actions as editorActions } from '../../../flux/editor';
import i18n from '../../../lib/i18n';


export type MaterialTestingViewHandle = {
    onChange: () => void;
}

const MaterialTestingView = React.forwardRef<MaterialTestingViewHandle, {}>((_, ref) => {
    const dispatch = useDispatch();
    const [form] = Form.useForm();
    useEffect(() => {
        const savedData = editorStore.get(`${HEAD_LASER}lastMaterialTest`);
        if (savedData) {
            form.setFieldsValue(JSON.parse(savedData));
        }
    }, [form]);

    // const getFormData = () => {
    //     const formIDataBox = document.getElementById('formIDataBox') as HTMLFormElement;
    //     const formData = new FormData(formIDataBox);
    //     const dataObject = Object.fromEntries(formData.entries());
    //     return dataObject;
    // };


    const saveFormData = (values: any) => {
        editorStore.set(`${HEAD_LASER}lastMaterialTest`, JSON.stringify(values));
    };

    // 提供一个方法从表单中获取数据
    const handleOnChange = () => {
        form.validateFields()
            .then((values) => {
                saveFormData(values); // 保存数据到 localStorage
                const testParamData = Object.fromEntries(
                    Object.entries(values).map(([key, value]) => [key, Number(value)])
                );
                console.log('Form Data:', testParamData);
                dispatch(editorActions.createElementAndGenToolPath(HEAD_LASER, testParamData));
            })
            .catch((error) => {
                console.error('Validation Failed:', error);
            });
    };

    useImperativeHandle(ref, () => {
        return {
            onChange: handleOnChange,
        };
    }, [form, dispatch]);

    const speedFormItems = [
        { name: 'rectRows', label: i18n._('key_ui-views-MaterialTestModal-FormComponent-rows'), component: <InputNumber className={styles.input} min={1} max={11} defaultValue={10} name="rectRows" /> },
        {
            name: 'speedMin',
            suffix: 'mm/min',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-min'),
            component: <InputNumber controls={false} className={styles.input} min={0} name="speedMin" defaultValue={600} addonAfter={<span className={styles.suffix}>mm/min</span>} />
        },
        {
            name: 'speedMax',
            suffix: 'mm/min',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-max'),
            component: <InputNumber controls={false} className={styles.input} min={200} name="speedMax" defaultValue={18000} addonAfter={<span className={styles.suffix}>mm/min</span>} />
        },
        {
            name: 'rectHeight',
            suffix: 'mm',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-height'),
            component: <InputNumber controls={false} className={styles.input} min={1} max={30} defaultValue={5} name="rectHeight" addonAfter={<span className={styles.suffix}>mm</span>} />
        },
    ];
    const powerFormItems = [
        { name: 'rectCols', label: i18n._('key_ui-views-MaterialTestModal-FormComponent-columnCount'), component: <InputNumber className={styles.input} min={1} max={11} defaultValue={10} name="rectCols" /> },
        {
            name: 'powerMin',
            suffix: '%',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-min'),
            component: <InputNumber controls={false} className={styles.input} max={100} min={0} defaultValue={10} name="powerMin" addonAfter={<span className={styles.suffix}>%</span>} />
        },
        {
            name: 'powerMax',
            suffix: '%',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-max'),
            component: <InputNumber controls={false} className={styles.input} max={100} min={1} defaultValue={100} name="powerMax" addonAfter={<span className={styles.suffix}>%</span>} />
        },
        {
            name: 'rectWidth',
            suffix: 'mm',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-width'),
            component: <InputNumber controls={false} className={styles.input} max={30} min={1} defaultValue={5} name="rectWidth" addonAfter={<span className={styles.suffix}>mm</span>} />
        },
    ];
    return (
        <>
            <Form id="formIDataBox" form={form} labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
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
                            <Form.Item name={item.name} key={item.label} label={<span className={styles['input-label']}>{item.label}</span>} colon={false} className={styles['form-item']}>
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
                            <Form.Item name={item.name} key={item.label} label={<span className={styles['input-label']}>{item.label}</span>} colon={false} className={styles['form-item']}>
                                {item.component}
                            </Form.Item>
                        ))}
                    </Col>
                </Row>
            </Form>
        </>
    );
});

export default MaterialTestingView;
