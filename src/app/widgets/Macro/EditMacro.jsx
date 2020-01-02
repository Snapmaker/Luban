import chainedFunction from 'chained-function';
import get from 'lodash/get';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import { Form, Input, Textarea } from '../../components/Validation';
import i18n from '../../lib/i18n';
import portal from '../../lib/portal';
import * as validations from '../../lib/validations';

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
        const { id, name, content, repeat } = { ...modalParams };

        return (
            <Modal disableOverlay size="md" onClose={this.props.closeModal}>
                <Modal.Header>
                    <Modal.Title>
                        {i18n._('Edit Macro')}
                    </Modal.Title>
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
                            <span className="sm-parameter-row__label">{i18n._('Macro Name')}</span>
                            <Input
                                ref={c => {
                                    this.fields.name = c;
                                }}
                                type="text"
                                className="form-control"
                                name="name"
                                value={name}
                                validations={[validations.required]}
                            />
                        </div>
                        <div className="form-group">
                            <div>
                                <span className="sm-parameter-row__label">{i18n._('Macro Commands')}</span>
                            </div>
                            <Textarea
                                ref={c => {
                                    this.fields.content = c;
                                }}
                                rows="10"
                                className="form-control"
                                name="content"
                                value={content}
                                validations={[validations.required]}
                            />
                        </div>
                        <div className="form-group">
                            <span className="sm-parameter-row__label">{i18n._('Repeat')}</span>
                            <Input
                                ref={c => {
                                    this.fields.repeat = c;
                                }}
                                className="form-control"
                                style={{ width: '60px' }}
                                type="number"
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
                        btnStyle="danger"
                        className="pull-left"
                        onClick={() => {
                            const name_ = get(this.fields.name, 'value');

                            portal(({ onClose }) => (
                                <Modal disableOverlay={false} size="xs" onClose={onClose}>
                                    <Modal.Header>
                                        <Modal.Title>
                                            {i18n._('Delete Macro')}
                                        </Modal.Title>
                                    </Modal.Header>
                                    <Modal.Body>
                                        {i18n._('Delete this macro?')}
                                        <p><strong>{name_}</strong></p>
                                    </Modal.Body>
                                    <Modal.Footer>
                                        <Button onClick={onClose}>
                                            {i18n._('No')}
                                        </Button>
                                        <Button
                                            btnStyle="danger"
                                            onClick={chainedFunction(
                                                () => {
                                                    this.props.deleteMacro(id);
                                                    this.props.closeModal();
                                                },
                                                onClose
                                            )}
                                        >
                                            {i18n._('Yes')}
                                        </Button>
                                    </Modal.Footer>
                                </Modal>
                            ));
                        }}
                    >
                        {i18n._('Delete')}
                    </Button>
                    <Button
                        onClick={() => {
                            this.props.closeModal();
                        }}
                    >
                        {i18n._('Cancel')}
                    </Button>
                    <Button
                        btnStyle="primary"
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
                        {i18n._('Save Changes')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default EditMacro;
