/* eslint-disable */
import api from '../../api/index';
const fs = require('fs');
import Print3dConfigBean from './Print3dConfigBean';
const path = require("path");

import {
    WEB_CURA_CONFIG_DIR
} from '../../constants/index';

//bed
const value_bed_temperature_PLA = 50;
const value_bed_temperature_ABS = 80;
const value_bed_temperature_Custom = 0;

//bed layer0
const value_bed_temperature_Layer0_PLA = 50;
const value_bed_temperature_Layer0_ABS = 80;
const value_bed_temperature_Layer0_Custom = 0;

//print temp
const value_print_temperature_PLA = 198;
const value_print_temperature_ABS = 235;
const value_print_temperature_Custom = 0;

//print temp layer0
const value_print_temperature_Layer0_PLA = 200;
const value_print_temperature_Layer0_ABS = 238;
const value_print_temperature_Layer0_Custom = 0;

//print temp final
const value_print_temperature_Final_PLA = 198;
const value_print_temperature_Final_ABS = 235;
const value_print_temperature_Final_Custom = 0;

class Print3dConfigManager{
	constructor(){
		this.beanArr = [];
		this.dirCustomConfig = `${WEB_CURA_CONFIG_DIR}`;
	}
	strEndWith(originStr, endStr) {
		if(originStr === null || originStr == undefined || originStr.trim().length === 0){
			return false;
		}
		if(endStr === null || endStr == undefined || endStr.trim().length === 0){
			return false;
		}
		if (endStr.length > originStr.length){
			return false;
		}
		if(originStr.substring(originStr.length - endStr.length) === endStr){
			return true;
		} else {
			return false;
		}
	}
	isStrEmpty(str){
		if (str === null || str === undefined || str.trim().length === 0) {
			return false;
		}
		return true;
	}

	/********** adhesion ************/
	setAdhesion_skirt() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.adhesion_type.default_value = 'skirt';
		}
	}
	setAdhesion_brim() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.adhesion_type.default_value = 'brim';
		}
	}
	setAdhesion_raft() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.adhesion_type.default_value = 'raft';
		}
	}
	setAdhesion_none() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.adhesion_type.default_value = 'none';
		}
	}

	/********** support ************/
	setSupport_buildplate() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.support_enable.default_value = true;
			bean.jsonObj.overrides.support_type.default_value = 'buildplate';
		}
	}
	setSupport_everywhere() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.support_enable.default_value = true;
			bean.jsonObj.overrides.support_type.default_value = 'everywhere';
		}
	}
	setSupport_none() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.support_enable.default_value = false;
		}
	}
	/********** material ************/
	setMaterial_ABS() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.material_print_temperature.default_value = value_print_temperature_ABS;
			bean.jsonObj.overrides.material_print_temperature_layer_0.default_value = value_print_temperature_Layer0_ABS;
			bean.jsonObj.overrides.material_final_print_temperature.default_value = value_print_temperature_Final_ABS;

			bean.jsonObj.overrides.material_bed_temperature.default_value = value_bed_temperature_ABS;
			bean.jsonObj.overrides.material_bed_temperature_layer_0.default_value = value_bed_temperature_Layer0_ABS;
		}
	}
	setMaterial_PLA() {
		for (var bean of this.beanArr) {
			bean.jsonObj.overrides.material_print_temperature.default_value = value_print_temperature_PLA;
			bean.jsonObj.overrides.material_print_temperature_layer_0.default_value = value_print_temperature_Layer0_PLA;
			bean.jsonObj.overrides.material_final_print_temperature.default_value = value_print_temperature_Final_PLA;

			bean.jsonObj.overrides.material_bed_temperature.default_value = value_bed_temperature_PLA;
			bean.jsonObj.overrides.material_bed_temperature_layer_0.default_value = value_bed_temperature_Layer0_PLA;
		}
	}
    /********** main ************/
    loadConfigs(callback){
        let scope = this;
        scope.beanArr = [];
        const formData = new FormData();
        formData.append('type', 'retrieve');
        api.getPrint3dConfigs(formData).then((res) => {
        	const err = res.body.err;
        	if (err){
                callback(err, undefined);
                return;
			}
            const beanArrStr = res.body.beanArrStr;
            const tempArr = JSON.parse(beanArrStr);
            for (let item of tempArr){
                let bean = new Print3dConfigBean(item.jsonObj, item.isOfficial, item.filePath);
                scope.beanArr.push(bean);
            }
            callback(err, scope.beanArr);
        });
    }
    remove(beanName, callback){
        var scope = this;
    	if (scope.beanArr.length === 0) {
            callback(new Error('No config loaded'));
            return;
		}
        var targetBean = scope.findBeanByName(beanName);
        if (!targetBean) {
            callback(new Error('Can not find bean named ' + beanName));
            return;
        }
        if (targetBean.isOfficial){
            callback(new Error('Can not modify official config named ' + targetBean.jsonObj.name));
            return;
        }
        const formData = new FormData();
        formData.append('type', 'delete');
        formData.append('filePath', targetBean.filePath);
        api.getPrint3dConfigs(formData).then((res) => {
            var err = res.body.err;
            if (err && err.message) {
                callback(err);
            } else {
                //'remove succeed');
                for (let index in scope.beanArr) {
                    if (scope.beanArr[index].jsonObj.name === beanName){
                        scope.beanArr.splice(index, 1);
                        break;
                    }
                }
                callback(undefined);
            }
        });
	}
    rename(beanName, newName, callback){
        var scope = this;
        if (scope.beanArr.length === 0) {
            callback(new Error('No config loaded'));
            return;
        }
        var targetBean = scope.findBeanByName(beanName);
        if (!targetBean) {
            callback(new Error('Can not find bean named ' + beanName));
            return;
        }
        if (targetBean.isOfficial){
            callback(new Error('Can not modify official config named ' + targetBean.jsonObj.name));
            return;
        }
        targetBean.jsonObj.name = newName;
        const formData = new FormData();
        formData.append('type', 'update');
        formData.append('beanStr', JSON.stringify(targetBean));
        api.getPrint3dConfigs(formData).then((res) => {
            callback(res.body.err);
        });
    }
    // duplicate(beanName, newName, callback){
    //     var scope = this;
    //     if (scope.beanArr.length === 0) {
    //         callback(new Error('No config loaded'));
    //         return;
    //     }
    //     var targetBean = scope.findBeanByName(beanName);
    //     if (!targetBean) {
    //         callback(new Error('Can not find bean named ' + beanName));
    //         return;
    //     }
    //     targetBean.jsonObj.name = newName;
    //     const formData = new FormData();
    //     formData.append('type', 'create');
    //     formData.append('beanStr', JSON.stringify(targetBean));
    //     targetBean.jsonObj.name = beanName;
    //     api.getPrint3dConfigs(formData).then((res) => {
    //         const err = res.body.err;
    //         const beanStr = res.body.beanStr;
    //         if (!err){
    //             //succeed
    //             const beanObj = JSON.parse(beanStr);
    //             let bean = new Print3dConfigBean(beanObj.jsonObj, false, beanObj.filePath);
    //             scope.beanArr.push(bean);
    //         }
    //         callback(err);
    //     });
    // }
    duplicate(beanName, callback){
        var scope = this;
        if (scope.beanArr.length === 0) {
            callback(new Error('No config loaded'));
            return;
        }
        var targetBean = scope.findBeanByName(beanName);
        if (!targetBean) {
            callback(new Error('Can not find bean named ' + beanName));
            return;
        }
        //get avaiable name
        let newName = '#' + beanName;
        while (scope.findBeanByName(newName)){
            newName = '#' + newName;
        }
        targetBean.jsonObj.name = newName;
        const formData = new FormData();
        formData.append('type', 'create');
        formData.append('beanStr', JSON.stringify(targetBean));
        targetBean.jsonObj.name = beanName;
        api.getPrint3dConfigs(formData).then((res) => {
            const err = res.body.err;
            const beanStr = res.body.beanStr;
            if (!err){
                //succeed
                const beanObj = JSON.parse(beanStr);
                let bean = new Print3dConfigBean(beanObj.jsonObj, false, beanObj.filePath);
                scope.beanArr.push(bean);
            }
            callback(err, newName);
        });
    }
    findBeanByName(name){
        if (!name){
            return undefined;
        }
        var scope = this;
        for (var item of scope.beanArr){
            if (name.toLowerCase() === item.jsonObj.name.toLowerCase()){
                return item;
            }
        }
        return undefined;
	}
    saveModificationToFile(beanName, callback){
        var scope = this;
        if (scope.beanArr.length === 0) {
            callback(new Error('No config loaded'));
            return;
        }
        var targetBean = scope.findBeanByName(beanName);
        if (!targetBean) {
            callback(new Error('Can not find bean named ' + beanName));
            return;
        }
        if (targetBean.isOfficial){
            callback(new Error('Can not modify official config named ' + targetBean.jsonObj.name));
            return;
        }
        const formData = new FormData();
        formData.append('type', 'update');
        formData.append('beanStr', JSON.stringify(targetBean));
        api.getPrint3dConfigs(formData).then((res) => {
            const err = res.body.err;
            callback(err);
        });
	}
	getCustomBeanNames(){
        var scope = this;
        var names = [];
        for (var item of scope.beanArr){
            if (!item.isOfficial){
                names.push(item.jsonObj.name);
            }
        }
        return names;
    }
    saveForPrint(beanName, callback){
        var scope = this;
        if (scope.beanArr.length === 0) {
            callback(new Error('No config loaded'));
            return;
        }
        var targetBean = scope.findBeanByName(beanName);
        if (!targetBean) {
            callback(new Error('Can not find bean named ' + beanName));
            return;
        }
        var startGcode = this.getStartGcode(targetBean);
        var endGcode = this.getEndGcode();
        targetBean.jsonObj.overrides.machine_start_gcode.default_value = startGcode;
        targetBean.jsonObj.overrides.machine_end_gcode.default_value = endGcode;
        const formData = new FormData();
        formData.append('type', 'create');
        formData.append('beanStr', JSON.stringify(targetBean));
        formData.append('fileName', 'forPrint.def.json');
        api.getPrint3dConfigs(formData).then((res) => {
            const err = res.body.err;
            const beanStr = res.body.beanStr;
            if (!err){
                //succeed
                const beanObj = JSON.parse(beanStr);
                let bean = new Print3dConfigBean(beanObj.jsonObj, false, beanObj.filePath);
                callback(err, beanObj.filePath);
            }else {
                callback(err);
            }
        });
    }
    getStartGcode(bean){
        var bedEnable = bean.jsonObj.overrides.machine_heated_bed.default_value;

        var hotendTemp_Layer0 = bean.jsonObj.overrides.material_print_temperature_layer_0.default_value;

        var bedTemp_Layer0 = bean.jsonObj.overrides.material_bed_temperature_layer_0.default_value;

        var setTempCode;

        /***** 1.set bed temperature and not wait to reach the target temperature
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
        if (bedEnable)
        {
            setTempCode =
                'M140 S' + bedTemp_Layer0 +
                '\n' +
                'M109 S' + hotendTemp_Layer0 +
                '\n' +
                'M190 S' + bedTemp_Layer0;
        }
        else
        {
            setTempCode = 'M109 S' + hotendTemp_Layer0;
        }

        return '\n' +
            ';Start GCode begin' +
            '\n' +
            setTempCode +
            '\n' +
            'G28 ;Home' +
            '\n' +
            'G90 ;absolute positioning' +
            '\n' +
            'G1 X-4 Y-4' +
            '\n' +
            'G1 Z0 F3000' +
            '\n' +
            'G92 E0' +
            '\n' +
            'G1 F200 E20' +
            '\n' +
            'G92 E0' +
            '\n' +
            ';Start GCode end' +
            '\n';
    }
    getEndGcode(){
        var print3dDeviceSize = 125;
        var targetX = 0;
        var targetY = print3dDeviceSize;
        //FIXME: use relative to set targetZ(use: current z + 10).
        //It is ok even if targetZ is bigger than 125 because firmware has set limitation
        var targetZ = print3dDeviceSize;
        return '\n' +
            ';End GCode begin' +
            '\n' +
            'M104 S0 ;extruder heater off' +
            '\n' +
            'M140 S0 ;heated bed heater off (if you have it)' +
            '\n' +
            'G90 ;absolute positioning' +
            '\n' +
            'G92 E0' +
            '\n' +
            'G1 E-1 F300 ;retract the filament a bit before lifting the nozzle, to release some of the pressure' +
            '\n' +
            'G1 Z' + targetZ + ' E-1 F{speed_travel} ;move Z up a bit and retract filament even more' +
            '\n' +
            'G1 X' + targetX + ' F3000 ;move X to min endstops, so the head is out of the way' +
            '\n' +
            'G1 Y' + targetY + ' F3000 ;so the head is out of the way and Plate is moved forward' +
            '\n' +
            'M84 ;steppers off' +
            '\n' +
            ';End GCode end' +
            '\n';
    }
    updateAllConfigs(keyValueObj){
        if (!keyValueObj){
            return;
        }
        var scope = this;
        for (let bean of scope.beanArr){
            console.log('bean name:' + bean.jsonObj.name);
            for (let key in keyValueObj){
                if (bean.jsonObj.overrides[key]){
                    bean.jsonObj.overrides[key].default_value = keyValueObj[key];
                }else {
                    console.log('key not exist:' + key);
                }
            }
        }
    }
}

export default Print3dConfigManager;

