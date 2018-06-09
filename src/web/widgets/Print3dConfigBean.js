class Print3dConfigBean {
    // type: material/official/custom/adhesion_support
    constructor(type, jsonObj, filePath) {
        this.type = type;
        this.jsonObj = jsonObj;
        this.filePath = filePath;
    }

    deepCopy() {
        return new Print3dConfigBean(this.type, this.jsonObj, this.filePath);
    }
}

export default Print3dConfigBean;
