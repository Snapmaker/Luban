import { Button, Modal, Input, message } from 'antd';
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import connectActions from '../../../flux/workspace/actions-connect';

const OctoSetPort: React.FC = () => {
    const dispatch = useDispatch();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [port, setPort] = useState(5000);
    const showModal = () => {
        setIsModalOpen(true);
    };

    const handleOk = async () => {
        console.log('line:14 port::: ', port);
        const result = await dispatch(connectActions.onResetPort(port));
        console.log('line:19 x::: ', result);
        message.success(`Set port success, ${result}`);
        setIsModalOpen(false);
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    const handleSetPort = (e) => {
        if (!e.target.value) return;
        setPort(Number(e.target.value));
    };

    return (
        <>
            <Button type="primary" onClick={showModal}>
                set port
            </Button>
            <Modal title="Basic Modal" open={isModalOpen} onOk={handleOk} onCancel={handleCancel}>
                <Input value={port} onChange={handleSetPort} />
            </Modal>
        </>
    );
};

export default OctoSetPort;
