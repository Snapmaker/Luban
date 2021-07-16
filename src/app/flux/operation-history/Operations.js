export default class Operations {
    operations = [];

    push(...operations) {
        this.operations.push(...operations);
    }

    getItem(i) {
        return this.operations[i];
    }

    removeItem(i) {
        this.operations.splice(i, 1);
    }

    length() {
        return this.operations.length;
    }

    isEmpty() {
        return this.operations.length === 0;
    }

    mergePreviousOperation() {
        throw new Error('NotImplementedException');
    }
}
