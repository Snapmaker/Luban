import { Form, Input, InputNumber } from 'antd';
import chainedFunction from 'chained-function';
import PropTypes from 'prop-types';
import React, { useEffect } from 'react';

import i18n from '../../../lib/i18n';
import portal from '../../../lib/portal';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';

const EditMacro = (props) => {
    const { closeModal, modalParams, updateMacro, deleteMacro } = props;
    const { id, isDefault } = { ...modalParams };

    const [form] = Form.useForm();

    // name, content, repeat
    useEffect(() => {
        form.setFieldValue('name', modalParams.name);
    }, [form, modalParams.name]);

    useEffect(() => {
        form.setFieldValue('content', modalParams.content);
    }, [form, modalParams.content]);

    useEffect(() => {
        form.setFieldValue('repeat', modalParams.repeat);
    }, [form, modalParams.repeat]);

    const initialValues = {
        name: modalParams.name,
        content: modalParams.content,
        repeat: modalParams.repeat,
    };

    return (
        <Modal disableOverlay size="md" onClose={closeModal}>
            <Modal.Header>
                {i18n._('key-Workspace/Macro-Edit Macro')}
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
                            { type: 'number' },
                            { required: true },
                        ]}
                    >
                        <InputNumber min={1} precision={0} />
                    </Form.Item>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="default"
                    priority="level-two"
                    width="96px"
                    className="float-l"
                    disabled={isDefault}
                    onClick={() => {
                        const name_ = '';

                        portal(({ onClose }) => (
                            <Modal disableOverlay={false} size="xs" onClose={onClose}>
                                <Modal.Header>
                                    {/* <Modal.Title> */}
                                    {i18n._('key-Workspace/Macro-Delete Macro')}
                                    {/* </Modal.Title> */}
                                </Modal.Header>
                                <Modal.Body>
                                    {i18n._('key-Workspace/Macro-Delete this macro?')}
                                    <p><strong>{name_}</strong></p>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button
                                        priority="level-two"
                                        width="96px"
                                        type="default"
                                        onClick={onClose}
                                    >
                                        {i18n._('key-Workspace/Macro-Cancel')}
                                    </Button>
                                    <Button
                                        className="margin-left-8"
                                        priority="level-two"
                                        width="96px"
                                        onClick={chainedFunction(
                                            () => {
                                                deleteMacro(id);
                                                closeModal();
                                            },
                                            onClose
                                        )}
                                    >
                                        {i18n._('key-Workspace/Macro-Delete')}
                                    </Button>
                                </Modal.Footer>
                            </Modal>
                        ));
                    }}
                >
                    {i18n._('key-Workspace/Macro-Delete')}
                </Button>
                <Button
                    type="default"
                    className="margin-left-8"
                    priority="level-two"
                    width="96px"
                    onClick={closeModal}
                >
                    {i18n._('key-Workspace/Macro-Cancel')}
                </Button>
                <Button
                    priority="level-two"
                    width="96px"
                    className="margin-left-8"
                    onClick={() => {
                        updateMacro(id, {
                            name: form.getFieldValue('name'),
                            content: form.getFieldValue('content'),
                            repeat: form.getFieldValue('repeat'),
                        });
                        closeModal();
                    }}
                >
                    {i18n._('key-Workspace/Macro-Save')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

EditMacro.propTypes = {
    modalParams: PropTypes.object,
    updateMacro: PropTypes.func.isRequired,
    deleteMacro: PropTypes.func.isRequired,
    closeModal: PropTypes.func.isRequired,
};


export default EditMacro;
