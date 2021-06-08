import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { actions as menuActions } from '../../../flux/appbar-menu';
import styles from './styles.styl';


class Submenu extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        items: PropTypes.array,
        hideMenu: PropTypes.func.isRequired
    }

    actions = {
        clickMenu: (item) => {
            if (item.enabled && !item.submenu) {
                item.click.call(item);
                this.props.hideMenu();
            }
        }
    }

    render() {
        if (this.props.items) {
            return (
                <ul className={classNames(styles['lu-appbar-menu'], this.props.className)}>
                    {
                        this.props.items.length > 0 ? this.props.items.map((item) => {
                            if (item.type === 'separator') {
                                return (<li key={item.id} className={styles.separator} />);
                            } else {
                                return (
                                    <li key={item.label ? item.label : item.id} className={classNames(styles['menu-item'], item.enabled ? '' : styles.enabled)}>
                                        <div role="button" tabIndex="0" onKeyPress={() => {}} onClick={() => { this.actions.clickMenu(item); }}>
                                            <span className={styles.label}>{item.label}{item.active}</span>
                                            { item.submenu ? <span className={styles.rightArrow}>&gt;</span> : ''}
                                            { item.accelerator ? <span className={styles.accelerator}>{item.accelerator.replace(/CommandOrControl|CmdOrCtrl/ig, 'Ctrl')}</span> : ''}
                                            <SubmenuContainer className={classNames(styles['menu-submenu'], styles['sub-3'], styles.hide)} items={item.submenu} />
                                        </div>
                                    </li>
                                );
                            }
                        }) : ''
                    }
                </ul>
            );
        } else {
            return null;
        }
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        hideMenu: () => dispatch(menuActions.hideMenu())
    };
};

const SubmenuContainer = connect(null, mapDispatchToProps)(Submenu);

export default SubmenuContainer;
