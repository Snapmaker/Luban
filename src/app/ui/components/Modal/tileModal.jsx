import React, { PureComponent } from 'react';

import { Modal } from 'antd';
import './tileModal.styl';
import UniApi from '../../../lib/uni-api';

class TileModal extends PureComponent {
    static propTypes = {
        ...Modal.propTypes
    }

    static defaultProps = {
        ...Modal.defaultProps
    }

    componentDidMount() {
        UniApi.Event.emit('tile-modal:show', { component: this.props.children });
    }

    componentWillUnmount() {
        UniApi.Event.emit('tile-modal:hide');
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
