import pubsub from 'pubsub-js';
import api from '../api/index';
import Print3dConfigBean from './Print3dConfigBean';
import {
    ACTION_3DP_CONFIG_LOADED
} from '../constants';


class Print3dConfigManager {
    constructor() {
        this.materialBeanArr = [];
        this.customBeanArr = [];
        this.officialBeanArr = [];
        this.adhesionAndSupportBean = null;
    }
    loadAllConfigs() {
        this.__loadMaterialConfigs((err) => {
            if (!err) {
                pubsub.publish(ACTION_3DP_CONFIG_LOADED, 'material');
            }
        });
        this.__loadOfficialConfigs((err) => {
            if (!err) {
                pubsub.publish(ACTION_3DP_CONFIG_LOADED, 'official');
            }
        });
        this.__loadCustomConfigs((err) => {
            if (!err) {
                pubsub.publish(ACTION_3DP_CONFIG_LOADED, 'custom');
            }
        });
        this.__loadAdhesionAndSupportConfig((err) => {
            if (!err) {
                pubsub.publish(ACTION_3DP_CONFIG_LOADED, 'adhesion_support');
            }
        });
    }
    __loadMaterialConfigs(callback) {
        this.__loadConfigsByType('material', (err, beanArr) => {
            this.materialBeanArr = beanArr;
            callback(err);
        });
    }
    __loadOfficialConfigs(callback) {
        this.__loadConfigsByType('official', (err, beanArr) => {
            this.officialBeanArr = beanArr;
            callback(err);
        });
    }
    __loadCustomConfigs(callback) {
        this.__loadConfigsByType('custom', (err, beanArr) => {
            this.customBeanArr = beanArr;
            callback(err);
        });
    }
    __loadAdhesionAndSupportConfig(callback) {
        this.__loadConfigsByType('adhesion_support', (err, beanArr) => {
            this.adhesionAndSupportBean = beanArr.length > 0 ? beanArr[0] : null;
            callback(err);
        });
    }
    __loadConfigsByType(type, callback) {
        let beanArr = [];
        api.print3dConfigs.fetch(type).then((res) => {
            const err = res.body.err;
            if (err) {
                callback(err, beanArr);
                return;
            }
            const beanArrStr = res.body.beanArrStr;
            const tempArr = JSON.parse(beanArrStr);
            for (let item of tempArr) {
                let bean = new Print3dConfigBean(type, item.jsonObj, item.filePath);
                beanArr.push(bean);
            }
            callback(err, beanArr);
        });
    }
    findBean(type, name) {
        if (!type) {
            return null;
        }
        switch (type.toLowerCase()) {
            case 'material':
                return this.__findBeanInArr(name, this.materialBeanArr);
            case 'official':
                return this.__findBeanInArr(name, this.officialBeanArr);
            case 'custom':
                return this.__findBeanInArr(name, this.customBeanArr);
            case 'adhesion_support':
                return this.adhesionAndSupportBean;
            default:
                break;
        }
        return null;
    }
    __findBeanInArr(name, arr) {
        if (!name) {
            return null;
        }
        for (let item of arr) {
            if (name.toLowerCase() === item.jsonObj.name.toLowerCase()) {
                return item;
            }
        }
        return null;
    }
    // only allow remove custom config
    removeCustom(beanName, callback) {
        const scope = this;
        const targetBean = scope.findBean('custom', beanName);
        if (!targetBean) {
            if (callback && (typeof callback === 'function')) {
                callback(new Error('Can not find bean named ' + beanName));
            }
            return;
        }

        const data = { filePath: targetBean.filePath };
        api.print3dConfigs.delete(data).then((res) => {
            const err = res.body.err;
            if (!err) {
                for (let index in scope.customBeanArr) {
                    if (scope.customBeanArr[index].jsonObj.name === beanName) {
                        scope.customBeanArr.splice(index, 1);
                        break;
                    }
                }
            }
            if (callback && (typeof callback === 'function')) {
                callback(err);
            }
        });
    }
    renameCustom(beanName, newName, callback) {
        const scope = this;
        const targetBean = scope.findBean('custom', beanName);
        if (!targetBean) {
            if (callback && (typeof callback === 'function')) {
                callback(new Error('Can not find bean named ' + beanName));
            }
            return;
        }
        targetBean.jsonObj.name = newName;
        const formData = new FormData();
        formData.append('beanStr', JSON.stringify(targetBean));
        api.print3dConfigs.update(formData).then((res) => {
            const err = res.body.err;
            if (err) {
                // rollback
                targetBean.jsonObj.name = beanName;
            }
            if (callback && (typeof callback === 'function')) {
                callback(err);
            }
        });
    }
    // only allow duplicate official/custom config
    duplicateOfficialOrCustom(beanName, callback) {
        const scope = this;
        const targetBean = scope.findBean('custom', beanName) || scope.findBean('official', beanName);
        if (!targetBean) {
            if (callback && (typeof callback === 'function')) {
                callback(new Error('Can not find bean named ' + beanName));
            }
            return;
        }
        // get avaiable name
        let newName = '#' + beanName;
        while (scope.findBean('custom', newName)) {
            newName = '#' + newName;
        }
        targetBean.jsonObj.name = newName;
        const formData = new FormData();
        formData.append('beanStr', JSON.stringify(targetBean));
        targetBean.jsonObj.name = beanName;
        api.print3dConfigs.create(formData).then((res) => {
            const err = res.body.err;
            const beanStr = res.body.beanStr;
            if (err) {
                if (callback && (typeof callback === 'function')) {
                    callback(err);
                }
            } else {
                const beanObj = JSON.parse(beanStr);
                let bean = new Print3dConfigBean('custom', beanObj.jsonObj, beanObj.filePath);
                scope.customBeanArr.push(bean);
                if (callback && (typeof callback === 'function')) {
                    callback(err, beanObj.jsonObj.name);
                }
            }
        });
    }
    // only allow modify custom config
    saveModificationToFile(type, beanName, callback) {
        const scope = this;
        const targetBean = scope.findBean(type, beanName);
        if (!targetBean) {
            if (callback && (typeof callback === 'function')) {
                callback(new Error('Can not find bean named ' + beanName));
            }
            return;
        }
        // only update start/end gcode of for_print
        if (type === 'material' && beanName === 'for_print') {
            const startGcode = this.getStartGcode(targetBean);
            const endGcode = this.getEndGcode();
            targetBean.jsonObj.overrides.machine_start_gcode.default_value = startGcode;
            targetBean.jsonObj.overrides.machine_end_gcode.default_value = endGcode;
        }

        // fix bug: infill_sparse_density is not work, actually infill_line_distance works
        // todo: solve the bug by using another way
        // 0 if infill_sparse_density == 0
        // else (infill_line_width * 100) / infill_sparse_density * (2 if infill_pattern == 'grid'
        // else (3 if infill_pattern == 'triangles' or infill_pattern == 'cubic' or infill_pattern == 'cubicsubdiv' else (2 if infill_pattern == 'tetrahedral' else 1)))
        if (targetBean.jsonObj.overrides.infill_sparse_density) {
            if (targetBean.jsonObj.overrides.infill_sparse_density.default_value < 1) {
                targetBean.jsonObj.overrides.infill_line_distance.default_value = 0;
            } else {
                const infillSparseDensity = targetBean.jsonObj.overrides.infill_sparse_density.default_value;
                const infillLineWidth = 0.4; // defaule value in fdmprinter.def.json
                // use grid
                targetBean.jsonObj.overrides.infill_line_distance.default_value = (infillLineWidth * 100) / infillSparseDensity * 2;
            }
        }

        const formData = new FormData();
        formData.append('beanStr', JSON.stringify(targetBean));
        api.print3dConfigs.update(formData).then((res) => {
            const err = res.body.err;
            if (callback && (typeof callback === 'function')) {
                callback(err);
            }
        });
    }
    getCustomAndOfficialBeanNames() {
        let names = [];
        for (let item of this.officialBeanArr) {
            names.push(item.jsonObj.name);
        }
        for (let item of this.customBeanArr) {
            names.push(item.jsonObj.name);
        }
        return names;
    }

    getStartGcode(bean) {
        const bedEnable = bean.jsonObj.overrides.machine_heated_bed.default_value;
        const hotendTemp = bean.jsonObj.overrides.material_print_temperature.default_value;
        let hotendTempLayer0 = bean.jsonObj.overrides.material_print_temperature_layer_0.default_value;
        // Set at 0 to disable special handling of the initial layer.
        hotendTempLayer0 = (hotendTempLayer0 === 0) ? hotendTemp : hotendTempLayer0;
        const bedTempLayer0 = bean.jsonObj.overrides.material_bed_temperature_layer_0.default_value;

        // todo：check is number
        /**
         * 1.set bed temperature and not wait to reach the target temperature
         * 2.set hotend temperature and wait to reach the target temperature
         * 3.set bed temperature and wait to reach the target temperature
         * bed:
         * M190 wait
         * M140 not wait
         * hotend:
         * M109 wait
         * M104 not wait
         * example:
         * M140 S60
         * M109 S200
         * M190 S60
         */
        let setTempCode = '';
        if (bedEnable) {
            setTempCode =
                `M140 S${bedTempLayer0}\n` +
                `M109 S${hotendTempLayer0}\n` +
                `M190 S${bedTempLayer0}\n`;
        } else {
            setTempCode =
                `M109 S${hotendTempLayer0}\n`;
        }
        return '\n' +
            ';Start GCode begin\n' +
            setTempCode +
            'G28 ;Home\n' +
            'G90 ;absolute positioning\n' +
            'G1 X-4 Y-4\n' +
            'G1 Z0 F3000\n' +
            'G92 E0\n' +
            'G1 F200 E20\n' +
            'G92 E0\n' +
            ';Start GCode end\n';
    }

    getEndGcode() {
        const print3dDeviceSize = 125;
        const targetX = 0;
        const targetY = print3dDeviceSize;
        // FIXME: use relative to set targetZ(use: current z + 10).
        // It is ok even if targetZ is bigger than 125 because firmware has set limitation
        const targetZ = print3dDeviceSize;
        return '\n' +
            ';End GCode begin\n' +
            'M104 S0 ;extruder heater off\n' +
            'M140 S0 ;heated bed heater off (if you have it)\n' +
            'G90 ;absolute positioning\n' +
            'G92 E0\n' +
            'G1 E-1 F300 ;retract the filament a bit before lifting the nozzle, to release some of the pressure\n' +
            `G1 Z${targetZ} E-1 F{speed_travel} ;move Z up a bit and retract filament even more\n` +
            `G1 X${targetX} F3000 ;move X to min endstops, so the head is out of the way\n` +
            `G1 Y${targetY} F3000 ;so the head is out of the way and Plate is moved forward\n` +
            'M84 ;steppers off\n' +
            ';End GCode end\n';
    }
}

const print3dConfigManager = new Print3dConfigManager();

export default print3dConfigManager;
