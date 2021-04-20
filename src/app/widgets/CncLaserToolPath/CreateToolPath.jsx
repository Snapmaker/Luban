import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import PropTypes from 'prop-types';
import { PAGE_PROCESS } from '../../constants';
import { actions as editorActions } from '../../flux/editor';
import SvgIcon from '../../components/SvgIcon';

import i18n from '../../lib/i18n';
import styles from './styles.styl';

<<<<<<< HEAD
class CreateToolPath extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        setDisplay: PropTypes.func.isRequired,
        page: PropTypes.string.isRequired,
        toolPathTypes: PropTypes.array.isRequired,

        createToolPath: PropTypes.func.isRequired
    };

    thumbnail = React.createRef();

    actions = {
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Create Toolpath'));
        this.props.setDisplay(this.props.page === PAGE_PROCESS);
    }

    componentWillReceiveProps(nextProps) {
        this.props.setDisplay(nextProps.page === PAGE_PROCESS);
    }

    render() {
        return (
            <div>
                <div>
                    <button
                        type="button"
                        className="sm-btn-large sm-btn-default"
                        onClick={this.props.createToolPath}
                        style={{ display: 'block', width: '100%' }}
                        disabled={this.props.toolPathTypes.length === 0}
                    >
                        {i18n._('Create Toolpath')}
                    </button>
                    <div style={{ marginTop: '10px', height: '20px', textAlign: 'center' }}>
                        <SvgIcon
                            name="Information"
                            size={18}
                            color="#979899"
                            className={styles['focus-icon']}
                        />

                        <div style={{
                            display: 'inline-block',
                            color: '#979899',
                            fontSize: '14px',
                            fontFamily: 'Roboto-Regular, Roboto',
                            height: '19px',
                            lineHeight: '19px',
                            marginLeft: '9px'
                        }}
                        >
                            {i18n._('Select Object to Create Toolpath')}
                        </div>
                    </div>

=======
const CreateToolPath = (props) => {
    const headTypeState = useSelector(state => state[props.headType]);
    const page = headTypeState?.page;
    const toolPathTypes = headTypeState?.toolPathGroup?.getToolPathTypes();
    const dispatch = useDispatch();
    const createToolPath = () => dispatch(editorActions.createToolPath(props.headType));
    const fastCreateToolPath = () => dispatch(editorActions.fastCreateToolPath(props.headType));
    useEffect(() => {
        props.setTitle(i18n._('Create Toolpath'));
        props.setDisplay(page === PAGE_PROCESS);
    }, []); // << super important array
    useEffect(() => {
        props.setDisplay(page === PAGE_PROCESS);
    }, [page]);
    return (
        <div>
            <div className="clearfix" tyle={{ height: '20px', textAlign: 'center' }}>
                <img
                    src="../../images/cnc-laser/ic_warning_20x20.png"
                    style={{
                        marginTop: '-4px',
                        width: '20px',
                        height: '20px'
                    }}
                    alt="......"
                />
                <div style={{
                    display: 'inline-block',
                    color: '#979899',
                    fontSize: '14px',
                    fontFamily: 'Roboto-Regular, Roboto',
                    height: '19px',
                    lineHeight: '19px',
                    marginLeft: '9px'
                }}
                >
                    {i18n._('Select Object to Create Toolpath')}
>>>>>>> Refactor: Replace class to hooks on object list component
                </div>
            </div>
            <button
                type="button"
                className="sm-btn-large sm-btn-default"
                onClick={createToolPath}
                disabled={!(toolPathTypes.length === 1)}
                style={{ display: 'inline-block', width: '40%' }}
            >
                {i18n._('Create Toolpath')}
            </button>
            <button
                type="button"
                className="sm-btn-large sm-btn-default "
                onClick={fastCreateToolPath}
                style={{ display: 'inline-block', float: 'right', width: '40%' }}
            >
                {i18n._('Fast Create')}
            </button>
        </div>
    );
};
CreateToolPath.propTypes = {
    setTitle: PropTypes.func,
    headType: PropTypes.string,
    setDisplay: PropTypes.func
};
export default CreateToolPath;

// export const createToolPathNameByType = (type) => {
//     return `Toolpath - Picture${type}${count++}`;
// };
