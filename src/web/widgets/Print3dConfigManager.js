import api from '../api/index';


class Print3dConfigManager {
    constructor() {
        this.materialBeanArr = [];
        this.customBeanArr = [];
        this.officialBeanArr = [];
        this.adhesionAndSupportBean = null;
        this.size = {
            x: 1,
            y: 1,
            z: 1
        };
    }

    updateSize(size) {
        this.size = size;
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

        if (targetBean.jsonObj.overrides.layer_height) {
            const layerHeight = targetBean.jsonObj.overrides.layer_height.default_value;
            const wallThickness = targetBean.jsonObj.overrides.wall_thickness.default_value;
            const topThickness = targetBean.jsonObj.overrides.top_thickness.default_value;
            const bottomThickness = targetBean.jsonObj.overrides.bottom_thickness.default_value;
            targetBean.jsonObj.overrides.wall_line_count.default_value = wallThickness / layerHeight;
            targetBean.jsonObj.overrides.top_layers.default_value = topThickness / layerHeight;
            targetBean.jsonObj.overrides.bottom_layers.default_value = bottomThickness / layerHeight;
        }

        const formData = new FormData();
        formData.append('beanStr', JSON.stringify(targetBean));
        api.printingConfigs.update(formData).then((res) => {
            const err = res.body.err;
            if (callback && (typeof callback === 'function')) {
                callback(err);
            }
        });
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
        // FIXME: use relative to set targetZ(use: current z + 10).
        // It is ok even if targetZ is bigger than 125 because firmware has set limitation
        return '\n' +
            ';End GCode begin\n' +
            'M104 S0 ;extruder heater off\n' +
            'M140 S0 ;heated bed heater off (if you have it)\n' +
            'G90 ;absolute positioning\n' +
            'G92 E0\n' +
            'G1 E-1 F300 ;retract the filament a bit before lifting the nozzle, to release some of the pressure\n' +
            `G1 Z${this.size.z} E-1 F{speed_travel} ;move Z up a bit and retract filament even more\n` +
            `G1 X${0} F3000 ;move X to min endstops, so the head is out of the way\n` +
            `G1 Y${this.size.y} F3000 ;so the head is out of the way and Plate is moved forward\n` +
            'M84 ;steppers off\n' +
            ';End GCode end\n';
    }
}

const print3dConfigManager = new Print3dConfigManager();

export default print3dConfigManager;
