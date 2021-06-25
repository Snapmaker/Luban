import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import { actions as menuActions } from '../../../flux/appbar-menu';
import Submenu from './Submenu';
import styles from './styles.styl';


class Menu extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        items: PropTypes.array.isRequired,
        activateMenu: PropTypes.func.isRequired,
        hideMenu: PropTypes.func.isRequired
    }

    ulRef = React.createRef();

    actions = {
        activateMenu: (index) => {
            if (typeof this.props.items[index].click === 'function') {
                this.props.items[index].click();
            }
            this.props.activateMenu(index);
        },
        hideMenu: (event) => {
            if (event.path.indexOf(this.ulRef.current) < 1) {
                this.props.hideMenu();
            }
        }
    }

    componentDidMount() {
        window.document.body.addEventListener('click', this.actions.hideMenu);
    }

    componentWillUnmount() {
        window.document.body.removeEventListener('click', this.actions.hideMenu);
    }

    render() {
        return (
            <ul ref={this.ulRef} className={classNames(styles['lu-appbar-menu'], this.props.className)}>
                {
                    this.props.items.map((item, index) => {
                        if (item.type === 'separator') {
                            return (<li key={item.id} className={styles.separator} />);
                        } else {
                            return (
                                <li key={item.label ? item.label : item.id} className={classNames(styles['menu-item'])}>
                                    <span role="button" tabIndex="0" onKeyPress={() => {}} className={styles.label} onClick={(e) => { e.stopPropagation(); this.actions.activateMenu(index); }}>{item.label}{item.active}</span>
                                    { item.accelerator ? <span className={styles.accelerator}>{item.accelerator.replace(/CommandOrControl|CmdOrCtrl/ig, 'Ctrl')}</span> : ''}
                                    { item.active ? <Submenu className={classNames(styles['menu-submenu'], styles['sub-2'])} items={item.submenu} /> : '' }
                                </li>
                            );
                        }
                    })
                }
            </ul>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        items: state.appbarMenu.menu
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        activateMenu: (index) => dispatch(menuActions.activateMenu(index)),
        hideMenu: () => dispatch(menuActions.hideMenu())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Menu);
