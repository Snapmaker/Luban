export default class Operations {
    operations = [];

    push(...operations) {
        this.operations.push(...operations);
    }

    isEmpty() {
        return this.operations.length === 0;
    }

    mergePreviousOperation() {
        console.log('Operations.mergePreviousOperation');
    }
}
