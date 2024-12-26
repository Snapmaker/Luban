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
    const formInitValues = {
        rectRows: 10,
        speedMin: 600,
        speedMax: 18000,
        rectHeight: 5,
        rectCols: 10,
        powerMin: 10,
        powerMax: 100,
        rectWidth: 5,
    };
    useEffect(() => {
        const savedData = editorStore.get(`${HEAD_LASER}lastMaterialTest`);
        if (savedData) {
            form.setFieldsValue(JSON.parse(savedData));
        }
    }, [form]);

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
        { name: 'rectRows', label: i18n._('key_ui-views-MaterialTestModal-FormComponent-rows'), component: <InputNumber className={styles.input} min={1} max={11} name="rectRows" /> },
        {
            name: 'speedMin',
            suffix: 'mm/min',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-min'),
            component: <InputNumber controls={false} className={styles.input} min={0} name="speedMin" />
        },
        {
            name: 'speedMax',
            suffix: 'mm/min',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-max'),
            component: <InputNumber controls={false} className={styles.input} min={200} name="speedMax" />
        },
        {
            name: 'rectHeight',
            suffix: 'mm',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-height'),
            component: <InputNumber controls={false} className={styles.input} min={1} max={30} name="rectHeight" />
        },
    ];
    const powerFormItems = [
        { name: 'rectCols', label: i18n._('key_ui-views-MaterialTestModal-FormComponent-columnCount'), component: <InputNumber className={styles.input} min={1} max={11} name="rectCols" /> },
        {
            name: 'powerMin',
            suffix: '%',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-min'),
            component: <InputNumber controls={false} className={styles.input} max={100} min={0} name="powerMin" />
        },
        {
            name: 'powerMax',
            suffix: '%',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-max'),
            component: <InputNumber controls={false} className={styles.input} max={100} min={1} name="powerMax" />
        },
        {
            name: 'rectWidth',
            suffix: 'mm',
            label: i18n._('key_ui-views-MaterialTestModal-FormComponent-width'),
            component: <InputNumber controls={false} className={styles.input} max={30} min={1} name="rectWidth" />
        },
    ];
    return (
        <>
            <Form id="formIDataBox" initialValues={formInitValues} form={form} labelCol={{ span: 12 }} wrapperCol={{ span: 12 }}>
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
                            <div className={styles['input-box']}>
                                <Form.Item name={item.name} key={item.label} label={<span className={styles['input-label']}>{item.label}</span>} colon={false} className={styles['form-item']}>
                                    {item.component}
                                </Form.Item>
                                <div className={styles['input-suffix']}>{item.suffix}</div>
                            </div>
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
                            <div className={styles['input-box']}>
                                <Form.Item name={item.name} key={item.label} label={<span className={styles['input-label']}>{item.label}</span>} colon={false} className={styles['form-item']}>
                                    {item.component}
                                </Form.Item>
                                <div className={styles['input-suffix']}>{item.suffix}</div>
                            </div>
                        ))}
                    </Col>
                </Row>
            </Form>
        </>
    );
});

export default MaterialTestingView;
