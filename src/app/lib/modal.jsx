/* eslint react/no-set-state: 0 */
import pick from 'lodash/pick';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import i18n from './i18n';
import Modal from '../ui/components/Modal';
import { Button } from '../ui/components/Buttons';
import Checkbox from '../ui/components/Checkbox';

let outsideInputValue = '';
class ModalHOC extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        removeContainer: PropTypes.func.isRequired,
        defaultInputValue: PropTypes.string,
        type: PropTypes.string,
        cancelTitle: PropTypes.string,
        isConfirm: PropTypes.bool,
        title: PropTypes.node,
        body: PropTypes.node,
        footer: PropTypes.node,
        showChangeIgnore: PropTypes.bool
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        show: true,
        inputValue: this.props.defaultInputValue ? this.props.defaultInputValue : '',
        ignore: false
    };

    componentDidMount() {
        if (this.props.defaultInputValue) {
            outsideInputValue = this.props.defaultInputValue;
        }
    }

    onChangeInputValue = (event) => {
        this.setState({ inputValue: event.target.value });
        outsideInputValue = event.target.value;
    }

    handleClose = () => {
        this.setState({ show: false });
        setTimeout(() => {
            this.props.removeContainer();
            this.props.onClose && this.props.onClose(this.state.ignore);
        });
    };

    componentWillUnmountMount() {
        outsideInputValue = '';
    }

    render() {
        const { title, body, footer, size, type, cancelTitle, isConfirm } = this.props;
        const { show, inputValue } = this.state;
        const props = pick(this.props, Object.keys(Modal.propTypes));
        const defalutCancelTitle = isConfirm ? i18n._('key-Modal/Common-Confirm') : i18n._('key-Modal/Common-Cancel');
        const newTitle = cancelTitle ? i18n._(cancelTitle) : defalutCancelTitle;

        return (
            <Modal
                {...props}
                size={size || 'sm'}
                show={show}
                onClose={this.handleClose}
            >
                {title && (
                    <Modal.Header>
                        {/* <Modal.Title> */}
                        {title}
                        {/* </Modal.Title> */}
                    </Modal.Header>
                )}
                <Modal.Body>
                    {body}
                    {this.props.defaultInputValue && (
                        <input
                            type="text"
                            style={{
                                height: '30px',
                                width: '100%',
                                padding: '6px 12px',
                                fontSize: '13px',
                                lineHeight: '1.42857143',
                                color: '#282828',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderRadius: '4px',
                                borderColor: '#c8c8c8'
                            }}
                            onChange={this.onChangeInputValue}
                            value={inputValue}
                        />
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {type === 'buttonRight' && footer}
                    <Button
                        priority={isConfirm ? 'level-two' : ''}
                        type={isConfirm ? 'primary' : 'default'}
                        onClick={this.handleClose}
                        width="96px"
                    >
                        {newTitle}
                    </Button>
                    {type !== 'buttonRight' && footer}
                    {
                        this.props.showChangeIgnore
                        && (
                            <span className="float-l">
                                <Checkbox
                                    className=""
                                    defaultChecked={this.state.ignore}
                                    type="checkbox"
                                    checked={this.state.ignore}
                                    onChange={(event) => {
                                        this.setState({
                                            ignore: event.target.checked
                                        });
                                        this.props.onChangeIgnore && this.props.onChangeIgnore(event.target.checked);
                                    }}
                                />
                                <span>{i18n._('key-Modal/Common-Don\'t ask again')}</span>
                            </span>
                        )
                    }
                </Modal.Footer>
            </Modal>
        );
    }
}

export default (options) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const removeContainer = () => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    };
    const getInputValue = () => {
        return outsideInputValue;
    };

    const props = {
        ...options,
        removeContainer: removeContainer
    };

    ReactDOM.render(<ModalHOC {...props} />, container);
    // return popupActions
    return { close: removeContainer, getInputValue: getInputValue };
};
