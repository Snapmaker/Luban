import React, { PureComponent } from 'react';
import { Menu, Item, Separator, contextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.min.css';
import PropTypes from 'prop-types';


// ref: https://fkhadra.github.io/react-contexify/api/context-menu
class ContextMenu extends PureComponent {
    show(e) {
        e.preventDefault();
        contextMenu.show({
            id: this.props.id,
            event: e
        });
    }
    static hide() {
        contextMenu.hideAll();
    }
    render() {
        const { id, items = [] } = this.props;
        let key = 0;
        return (
            <div>
                <Menu id={id}>
                    {items.map((item) => {
                        if (!item) {
                            return null;
                        }
                        if (item === 'separator') {
                            return (
                                <Separator key={key++} />
                            );
                        } else {
                            const { name, disabled = false, onClick } = item;
                            return (
                                <Item key={key++} onClick={onClick} disabled={disabled}>{name}</Item>
                            );
                        }
                    })}
                </Menu>
            </div>
        );
    }
}

ContextMenu.propTypes = {
    id: PropTypes.string.isRequired,
    // example:
    //     items = [
    //         { name: 'a-1', disabled: false, onClick: () => console.log('a-1') },
    //         'separator',
    //         { name: 'a-2', disabled: true, onClick: () => console.log('a-2') },
    //         { name: 'a-3', disabled: false, onClick: () => console.log('a-3') }
    //     ];
    items: PropTypes.array.isRequired
};

export default ContextMenu;
