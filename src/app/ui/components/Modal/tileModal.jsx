import React, { PureComponent } from 'react';

import { Modal } from 'antd';
import './tileModal.styl';

class TileModal extends PureComponent {
    static propTypes = {
        ...Modal.propTypes
    }

    static defaultProps = {
        ...Modal.defaultProps
    }

    render() {
        return (
            <Modal
                wrapClassName="tile-modal"
                width="auto"
                visible
                mask={false}
                footer={null}
                onCancel={this.props.onClose}
            >
                {this.props.children}
            </Modal>
        );
    }
}

export default TileModal;
