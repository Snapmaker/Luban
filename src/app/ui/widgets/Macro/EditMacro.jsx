import chainedFunction from 'chained-function';
import get from 'lodash/get';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import { Form, Input, Textarea } from '../../components/Validation';
import i18n from '../../../lib/i18n';
import portal from '../../../lib/portal';
import * as validations from '../../../lib/validations';

class EditMacro extends PureComponent {
    static propTypes = {
        modalParams: PropTypes.object,
        updateMacro: PropTypes.func.isRequired,
        deleteMacro: PropTypes.func.isRequired,
        closeModal: PropTypes.func.isRequired
    };

    fields = {
        name: null,
        content: null,
        repeat: null
    };

    get value() {
        const {
            name,
            content,
            repeat
        } = this.form.getValues();

        return {
            name,
            content,
            repeat
        };
    }

    render() {
        const { modalParams } = this.props;
        const { id, name, content, repeat, isDefault } = { ...modalParams };
        return (
            <Modal disableOverlay size="md" onClose={this.props.closeModal}>
                <Modal.Header>
                    {/* <Modal.Title> */}
                    {i18n._('key-Workspace/Macro-Edit Macro')}
                    {/* </Modal.Title> */}
                </Modal.Header>
                <Modal.Body>
                    <Form
                        ref={c => {
                            this.form = c;
                        }}
                        onSubmit={(event) => {
                            event.preventDefault();
                        }}
                    >
                        <div className="form-group">
                            <span className="">{i18n._('key-Workspace/Macro-Macro Name')}</span>
                            <Input
                                ref={c => {
                                    this.fields.name = c;
                                }}
                                style={{ borderRadius: '8px' }}
                                type="text"
                                className="form-control"
                                name="name"
                                value={name}
                                validations={[validations.required]}
                            />
                        </div>
                        <div className="form-group">
                            <div>
                                <span className="">{i18n._('key-Workspace/Macro-Macro Commands')}</span>
                            </div>
                            <Textarea
                                ref={c => {
                                    this.fields.content = c;
                                }}
                                style={{ borderRadius: '8px' }}
                                rows="10"
                                className="form-control"
                                name="content"
                                value={content}
                                validations={[validations.required]}
                            />
                        </div>
                        <div className="form-group">
                            <span className="">{i18n._('key-Workspace/Macro-Repeat')}</span>
                            <Input
                                ref={c => {
                                    this.fields.repeat = c;
                                }}
                                style={{ borderRadius: '8px', width: 120 }}
                                type="number"
                                className="form-control"
                                name="repeat"
                                value={repeat}
                                min={1}
                                validations={[validations.required]}
                            />
                        </div>
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
                            const name_ = get(this.fields.name, 'value');

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
                                                    this.props.deleteMacro(id);
                                                    this.props.closeModal();
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
                        onClick={() => {
                            this.props.closeModal();
                        }}
                    >
                        {i18n._('key-Workspace/Macro-Cancel')}
                    </Button>
                    <Button
                        className="margin-left-8"
                        priority="level-two"
                        width="96px"
                        onClick={() => {
                            this.form.validate(err => {
                                if (err) {
                                    return;
                                }
                                this.props.updateMacro(id, { name: this.value.name, content: this.value.content, repeat: this.value.repeat });
                                this.props.closeModal();
                            });
                        }}
                    >
                        {i18n._('key-Workspace/Macro-Save')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default EditMacro;
