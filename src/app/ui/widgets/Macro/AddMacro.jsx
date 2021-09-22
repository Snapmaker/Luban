import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from '../../components/Buttons';
import Modal from '../../components/Modal';
import { Form, Input, Textarea } from '../../components/Validation';
import { NumberInput } from '../../components/Input';
import i18n from '../../../lib/i18n';
import * as validations from '../../../lib/validations';

class AddMacro extends PureComponent {
    static propTypes = {
        modalParams: PropTypes.object,
        addMacro: PropTypes.func.isRequired,
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
        const { content = '', repeat = 1 } = { ...modalParams };

        return (
            <Modal disableOverlay size="md" onClose={this.props.closeModal}>
                <Modal.Header>
                    {/* <Modal.Title> */}
                    {i18n._('key_ui/widgets/Macro/AddMacro_New Macro')}
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
                            <span className="">{i18n._('key_ui/widgets/Macro/AddMacro_Macro Name')}</span>
                            <Input
                                ref={c => {
                                    this.fields.name = c;
                                }}
                                style={{ borderRadius: '8px' }}
                                type="text"
                                className="form-control"
                                name="name"
                                value=""
                                validations={[validations.required]}
                            />
                        </div>
                        <div className="form-group">
                            <div>
                                <span className="">{i18n._('key_ui/widgets/Macro/AddMacro_Macro Commands')}</span>
                            </div>
                            <Textarea
                                style={{ borderRadius: '8px' }}
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
                            <span className="">{i18n._('key_ui/widgets/Macro/AddMacro_Repeat')}</span>
                            <NumberInput
                                ref={c => {
                                    this.fields.repeat = c;
                                }}
                                className="display-block"
                                value={repeat}
                                name="repeat"
                                min={1}
                                validations={[validations.required]}
                            />
                        </div>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={this.props.closeModal}
                        type="default"
                        priority="level-two"
                        width="96px"
                    >
                        {i18n._('key_ui/widgets/Macro/AddMacro_Cancel')}
                    </Button>
                    <Button
                        priority="level-two"
                        width="96px"
                        className="margin-left-8"
                        onClick={() => {
                            this.form.validate(err => {
                                if (err) {
                                    return;
                                }
                                this.props.addMacro({ name: this.value.name, content: this.value.content, repeat: this.value.repeat });
                                this.props.closeModal();
                            });
                        }}
                    >
                        {i18n._('key_ui/widgets/Macro/AddMacro_Save')}
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default AddMacro;
