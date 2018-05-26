/* eslint-disable */
import api from '../../api/index';
const fs = require('fs');
import Print3dConfigBean from '../../containers/Print3D/Print3dConfigBean';
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
    duplicate(beanName, newName, callback){
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
        targetBean.jsonObj.name = newName;
        const formData = new FormData();
        formData.append('type', 'create');
        formData.append('beanStr', JSON.stringify(targetBean));
        api.getPrint3dConfigs(formData).then((res) => {
            const err = res.body.err;
            const beanStr = res.body.beanStr;
            if (!err){
                //succeed
                const beanObj = JSON.parse(beanStr);
                let bean = new Print3dConfigBean(beanObj.jsonObj, false, beanObj.filePath);
                scope.beanArr.push(bean);
            }
            callback(err);
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
}

export default Print3dConfigManager;

