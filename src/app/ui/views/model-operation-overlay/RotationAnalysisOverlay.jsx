import React, { useEffect, useState, useRef } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button } from '../../components/Buttons';
import TipTrigger from '../../components/TipTrigger';
import { actions as printingActions } from '../../../flux/printing';
import { actions as menuActions } from '../../../flux/appbar-menu';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import { HEAD_PRINTING } from '../../../constants';
import { logTransformOperation } from '../../../lib/gaEvent';

function normalizeNum(num) {
    if (typeof num === 'number') {
        if (num < 1) {
            return +((num).toFixed(2));
        } else {
            return Math.floor(num);
        }
    }
    return num;
}
function initColumns() {
    return [
        {
            title: i18n._('key-Printing/RotationAnalyze-No'),
            description: i18n._('key-Printing/RotationAnalyze-No'),
            dataIndex: 'key',
            order: 'asc'
        },
        {
            title: i18n._('key-Printing/RotationAnalyze-Areas'),
            description: i18n._('key-Printing/RotationAnalyze-Areas Hover'),
            dataIndex: 'area',
            order: ''
        },
        {
            title: i18n._('key-Printing/RoationAnalyze-Support Volume'),
            description: i18n._('key-Printing/RoationAnalyze-Support Volume Hover'),
            dataIndex: 'supportVolume',
            order: ''
        }
    ];
}

let columns = [];
let initialTransformation = {};
let loopIndex = 1;
const Table = React.memo(({ tableColumns, onRowSelect, selectedRow, data, setData, scrollToSelectedRow }) => {
    const refThead = useRef();
    const refTbody = useRef();
    const refScroll = useRef();
    const [showScrollWidth, setShowScrollWidth] = useState(0);
    const [colWidthArr, setColWidthArr] = useState(new Array(tableColumns.length).fill(0));

    const actions = {
        changeColOrder: (column) => {
            tableColumns.forEach(col => {
                if (col !== column) {
                    col.order = '';
                }
            });
            switch (column.order) {
                case '':
                case 'asc': {
                    column.order = 'desc';
                    setData(data.slice(0).sort((a, b) => b[column.dataIndex] - a[column.dataIndex]));
                    break;
                }
                case 'desc': {
                    column.order = 'asc';
                    setData(data.slice(0).sort((a, b) => a[column.dataIndex] - b[column.dataIndex]));
                    break;
                }
                default: break;
            }
        },
        columnStyle: (item) => {
            switch (item.order) {
                case 'desc':
                    return (<div className={classNames(styles.sort, styles.desc)} />);
                case 'asc':
                    return (<div className={classNames(styles.sort, styles.asc)} />);
                default: return (<div className={classNames(styles.sort)} />);
            }
        }
    };

    useEffect(() => {
        if (refThead.current.children[0] && refTbody.current.children[0]) {
            const headCeilWidthArr = Array.prototype.slice.call(refThead.current.children[0].children).map(el => Math.ceil(el.getBoundingClientRect().width));
            const bodyCeilWidthArr = Array.prototype.slice.call(refTbody.current.children[0].children).map(el => Math.ceil(el.getBoundingClientRect().width));
            const scrollbarVisible = (Math.floor(refScroll.current.getBoundingClientRect().width) > refScroll.current.clientWidth);
            const newWidthArr = [];

            setShowScrollWidth(scrollbarVisible);
            for (let i = 0; i < headCeilWidthArr.length; i++) {
                newWidthArr.push(Math.max(headCeilWidthArr[i], bodyCeilWidthArr[i]));
            }
            if (newWidthArr.join() !== colWidthArr.join()) {
                setColWidthArr(newWidthArr);
            }
        }
    }, [tableColumns, data]);
    useEffect(() => {
        const index = data.indexOf(selectedRow);
        if (index > -1 && scrollToSelectedRow) {
            refTbody.current.children[index].scrollIntoView();
        }
    }, [selectedRow]);
    return (
        <div>
            <table>
                <thead ref={refThead}>
                    <tr>
                        {
                            tableColumns.map((item, i) => {
                                return (
                                    <th key={++loopIndex} onClick={() => actions.changeColOrder(item)} style={{ width: `${colWidthArr[i]}px` }}>
                                        <TipTrigger
                                            placement="right"
                                            title={i18n._(item.title)}
                                            content={i18n._(item.description)}
                                        >
                                            <div className={classNames(styles['th-title'])}>
                                                {i18n._(item.title)}
                                            </div>
                                            {actions.columnStyle(item)}
                                        </TipTrigger>
                                    </th>
                                );
                            }).concat((showScrollWidth ? <th key={++loopIndex} className={classNames(styles.scrollbar)} /> : null))
                        }
                    </tr>
                </thead>
            </table>
            <div className={classNames(styles.scroll)} ref={refScroll}>
                {data.length === 0 ? <div className="text-center padding-vertical-56">{i18n._('key-Printing/RotationAnalyze-Loading')}</div> : null}
                <table>
                    <tbody ref={refTbody}>
                        {
                            data.map((item) => {
                                return (
                                    <tr key={++loopIndex} onClick={() => onRowSelect(item)} className={classNames((selectedRow === item ? styles.selected : ''))}>
                                        {
                                            tableColumns.map((col, i) => {
                                                return (<td key={++loopIndex} style={{ width: `${colWidthArr[i]}px` }}>{item[col.dataIndex]}</td>);
                                            })
                                        }
                                    </tr>
                                );
                            })
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
});
Table.propTypes = {
    tableColumns: PropTypes.array.isRequired,
    data: PropTypes.array.isRequired,
    setData: PropTypes.func.isRequired,
    onRowSelect: PropTypes.func.isRequired,
    scrollToSelectedRow: PropTypes.bool,
    selectedRow: PropTypes.object
};

function RotationAnalysisOverlay({ onClose }) {
    const dispatch = useDispatch();
    const rotationAnalysisTable = useSelector(state => state.printing.rotationAnalysisTable, shallowEqual);
    const rotationAnalysisSelectedRowId = useSelector(state => state.printing.rotationAnalysisSelectedRowId, shallowEqual);
    const modelGroup = useSelector(state => state.printing.modelGroup, shallowEqual);
    const [selectedRow, setSelectedRow] = useState(null);
    const [scrollToSelectedRow, setScrollToSelectedRow] = useState(null);
    const [data, setData] = useState([]);

    const actions = {
        finish: () => {
            dispatch(printingActions.finishAnalyzeRotation());
            logTransformOperation(HEAD_PRINTING, 'roate', 'analyze_out');
            onClose();
        },
        onRowSelect: (row, scrollIntoView = false) => {
            if (row && selectedRow !== row) {
                setSelectedRow(row);
                setScrollToSelectedRow(scrollIntoView);
                // restore initial transformation
                const model = modelGroup.selectedModelArray[0];
                modelGroup.unselectAllModels();
                model.meshObject.position.set(initialTransformation.positionX, initialTransformation.positionY, initialTransformation.positionZ);
                model.meshObject.rotation.set(initialTransformation.rotationX, initialTransformation.rotationY, initialTransformation.rotationZ);
                model.meshObject.scale.set(initialTransformation.scaleX, initialTransformation.scaleY, initialTransformation.scaleZ);
                modelGroup.selectModelById(model.modelID);
                model.stickToPlate();
                model.computeBoundingBox();
                const overstepped = modelGroup._checkOverstepped(model);
                model.setOversteppedAndSelected(overstepped, model.isSelected);

                dispatch(printingActions.rotateByPlane(row.plane));
                dispatch(printingActions.setRotationPlacementFace({ index: row.faceId }));
            }
        },
        exitModal: (e) => {
            if (e.keyCode === 27) {
                e.stopPropagation();
                actions.finish();
            }
        }
    };

    useEffect(() => {
        columns = initColumns();

        // Mousetrap doesn't support unbind specific shortcut callback, use native instead
        window.addEventListener('keydown', actions.exitModal, true);
        dispatch(printingActions.startAnalyzeRotation());
        initialTransformation = { ...modelGroup.selectedModelArray[0].transformation };
        dispatch(printingActions.analyzeSelectedModelRotation());
        dispatch(printingActions.setShortcutStatus(false));
        dispatch(printingActions.setLeftBarOverlayVisible(true));
        dispatch(menuActions.disableMenu());

        return () => {
            dispatch(printingActions.setShortcutStatus(true));
            dispatch(printingActions.setLeftBarOverlayVisible(false));
            dispatch(menuActions.enableMenu());
            window.removeEventListener('keydown', actions.exitModal, true);
            initialTransformation = null;
        };
    }, []);

    useEffect(() => {
        if (rotationAnalysisTable) {
            const tableData = rotationAnalysisTable.map((item, index) => {
                item.key = index + 1;
                return item;
            });
            // normalize number format
            tableData.forEach((item) => {
                for (const k of Object.keys(item)) {
                    item[k] = normalizeNum(item[k]);
                }
            });
            setData(tableData);
            const defaultIndex = 0;
            const defaultSelected = tableData[defaultIndex];
            actions.onRowSelect(defaultSelected);
        }
    }, [rotationAnalysisTable]);

    useEffect(() => {
        if (rotationAnalysisSelectedRowId > -1) {
            const row = data.find(item => item.faceId === rotationAnalysisSelectedRowId);
            actions.onRowSelect(row, true);
        }
    }, [rotationAnalysisSelectedRowId]);
    return (
        <div className={classNames(styles['rotation-analysis'])}>
            <header>
                <span style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: '#545659',
                    margin: 0
                }}
                >
                    {i18n._('key-Printing/LeftBar-Select Placement Face')}
                </span>
            </header>
            <section>
                <Table
                    tableColumns={columns}
                    data={data}
                    setData={setData}
                    selectedRow={selectedRow}
                    onRowSelect={actions.onRowSelect}
                    scrollToSelectedRow={scrollToSelectedRow}
                />
            </section>
            <footer>
                <Button
                    onClick={actions.finish}
                    priority="level-two"
                    width="96px"
                    className="margin-left-8"
                >
                    {i18n._('key-Printing/RoationAnalyze-Complete')}
                </Button>
            </footer>
        </div>
    );
}
RotationAnalysisOverlay.propTypes = {
    onClose: PropTypes.func.isRequired
};

export default RotationAnalysisOverlay;
