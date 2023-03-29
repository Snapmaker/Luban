import { Form, Input, InputNumber } from 'antd';
import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import i18n from '../../../lib/i18n';
import log from '../../../lib/log';

import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';


const AddMacro = (props) => {
    const {
        closeModal,
        modalParams,
        addMacro,
    } = props;

    const [form] = Form.useForm();

    useEffect(() => {
        form.setFieldValue('name', modalParams.name || '');
    }, [form, modalParams.name]);

    useEffect(() => {
        form.setFieldValue('content', modalParams.content || '');
    }, [form, modalParams.content]);

    useEffect(() => {
        form.setFieldValue('repeat', modalParams.repeat || 1);
    }, [form, modalParams.repeat]);

    const initialValues = {
        name: modalParams.name || '',
        content: modalParams.content || '',
        repeat: modalParams.repeat || 1,
    };

    return (
        <Modal disableOverlay size="md" onClose={closeModal}>
            <Modal.Header>
                {i18n._('key-Workspace/Macro-New Macro')}
            </Modal.Header>
            <Modal.Body>
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={initialValues}
                >
                    <Form.Item
                        name="name"
                        label={i18n._('key-Workspace/Macro-Macro Name')}
                        rules={[{ required: true }]}
                    >
                        <Input type="text" />
                    </Form.Item>
                    <Form.Item
                        name="content"
                        label={i18n._('key-Workspace/Macro-Macro Commands')}
                        rules={[{ required: true }]}
                    >
                        <Input.TextArea rows={10} />
                    </Form.Item>
                    <Form.Item
                        name="repeat"
                        label={i18n._('key-Workspace/Macro-Repeat')}
                        rules={[
                            // { type: 'number' },
                            { required: true },
                        ]}
                    >
                        <InputNumber min={1} precision={0} />
                    </Form.Item>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    onClick={closeModal}
                    type="default"
                    priority="level-two"
                    width="96px"
                >
                    {i18n._('key-Workspace/Macro-Cancel')}
                </Button>
                <Button
                    priority="level-two"
                    width="96px"
                    className="margin-left-8"
                    onClick={async () => {
                        try {
                            // validate fields right now
                            await form.validateFields();

                            addMacro({
                                name: form.getFieldValue('name'),
                                content: form.getFieldValue('content'),
                                repeat: form.getFieldValue('repeat'),
                            });
                            closeModal();
                        } catch (e) {
                            // log errorInfo of the form
                            log.warn(e);
                        }
                    }}
                >
                    {i18n._('key-Workspace/Macro-Save')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

AddMacro.propTypes = {
    modalParams: PropTypes.object,
    addMacro: PropTypes.func.isRequired,
    closeModal: PropTypes.func.isRequired,
};

export default AddMacro;
