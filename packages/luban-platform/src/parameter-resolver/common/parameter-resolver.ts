import { tokenize } from 'esprima-next';
import { cloneDeep, isNil, isUndefined } from 'lodash';

import log from '../../lib/log';

// We put with statement into an ES5 module
import ParameterContext from './parameter-context.es5';

declare type ModifyParameterItem = [string, number | string | boolean];

const KEYWORDS = new Set([
    'Math',
    'round',
    'max',
    'min',
    'ceil',
    'Number',
    'parseInt',
    'resolveOrValue',
    'extruderValue',
    'extruderValues',
    'defaultExtruderPosition',
]);

const parameterMap = new Map();

class DependencyGraph {
    private dependencies: { [key: string]: Set<string> } = {};

    // affects dict is the counter part of dependencies
    private affects: { [key: string]: Set<string> } = {};

    private topologicalOrderedKeys?: string[] = null;

    public addKey(key: string): void {
        if (!this.dependencies[key]) {
            this.dependencies[key] = new Set();
        }

        if (!this.affects[key]) {
            this.affects[key] = new Set();
        }
    }

    public getKeys(): string[] {
        return Object.keys(this.dependencies);
    }

    public addDependency(key: string, dependsKey: string): void {
        this.addKey(key);
        this.dependencies[key].add(dependsKey);

        this.addKey(dependsKey);
        this.affects[dependsKey].add(key);
    }

    public getDependencies(key: string): string[] {
        if (!this.dependencies[key]) {
            return [];
        }
        return Array.from(this.dependencies[key]);
    }

    public getAffects(key: string): string[] {
        if (!this.affects[key]) {
            return [];
        }
        return Array.from(this.affects[key]);
    }

    public calculateTopologicalGraph(): void {
        const degree = {};

        const keys = Object.keys(this.dependencies);
        for (const key of keys) {
            degree[key] = this.dependencies[key].size;
        }

        this.topologicalOrderedKeys = [];
        while (true) {
            let hasUpdate = false;
            for (const key of keys) {
                if (degree[key] === 0) {
                    hasUpdate = true;
                    degree[key] = -1;

                    this.topologicalOrderedKeys.push(key);

                    for (const affectedKey of this.affects[key]) {
                        degree[affectedKey]--;
                    }
                }
            }
            if (!hasUpdate) {
                break;
            }
        }

        if (this.topologicalOrderedKeys.length !== keys.length) {
            log.error('Topological graph can not be calculated.');

            this.topologicalOrderedKeys = null;
        }
    }

    public getTopologicalOrder(key: string): number {
        if (this.topologicalOrderedKeys) {
            return this.topologicalOrderedKeys.indexOf(key);
        }

        return -1;
    }
}


const valueGraph = new DependencyGraph();
const calculatedValueGraph = new DependencyGraph();

/**
 * Calculate parameter values expression to topological graph.
 *
 * 605 parameters
 * for calcu_value, 137 parameters have deps (194 deps in total)
 * for visible, 212 parameters have deps (415 deps in total)
 */
function calculateParameterTopologicalGraph() {
    const allParameterKeys = Array.from(parameterMap.keys());

    // parse expression to identifiers
    function parseExpression(key: string, expression: string): string[] {
        const tokens = tokenize(expression);
        const identifiers = [];
        for (const tokenItem of tokens) {
            if (tokenItem.type === 'Identifier' && !KEYWORDS.has(tokenItem.value)) {
                identifiers.push(tokenItem.value);
            }
        }
        return identifiers;
    }

    for (const [key, parameterItem] of parameterMap) {
        if (parameterItem.calcu_value) {
            const identifiers = parseExpression(key, `${parameterItem.calcu_value}`);
            for (const identifier of identifiers) {
                valueGraph.addDependency(key, identifier);
            }
        }
        if (parameterItem.visible) {
            const identifiers = parseExpression(key, `${parameterItem.visible}`);
            for (const identifier of identifiers) {
                calculatedValueGraph.addDependency(key, identifier);
            }
        }

        if (parameterItem.min) {
            const identifiers = parseExpression(key, `${parameterItem.min}`);
            for (const identifier of identifiers) {
                calculatedValueGraph.addDependency(key, identifier);
            }
        }
        if (parameterItem.max) {
            const identifiers = parseExpression(key, `${parameterItem.max}`);
            for (const identifier of identifiers) {
                calculatedValueGraph.addDependency(key, identifier);
            }
        }
    }

    for (const key of allParameterKeys) {
        valueGraph.addKey(key);
        calculatedValueGraph.addKey(key);
    }

    valueGraph.calculateTopologicalGraph();
    calculatedValueGraph.calculateTopologicalGraph();
}

const allContext = {};

function getContext(definition, contextKey = '') {
    contextKey = contextKey || definition.definitionId;

    if (allContext[contextKey]) {
        return allContext[contextKey];
    }

    // Create a new context
    const ctx = {
        resolveOrValue: (input) => (input),
        // extruderValue: (ignore, input) => input,
        // extruderValues: (input) => [input],
        defaultExtruderPosition: () => 0,
    };

    const newContext = new ParameterContext();

    // @ts-ignore
    newContext.setContext(ctx);

    const obj = definition.settings;
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value.type && (value.type !== 'category' && value.type !== 'mainCategory')) {
            if (!parameterMap.get(key)) {
                const cloneValue = cloneDeep(value);
                parameterMap.set(key, cloneValue);
            }

            // @ts-ignore
            // define getter to read default_value
            // define setter to write default_value
            newContext.defineProperty(
                key,
                () => {
                    return value.default_value;
                },
                (v) => {
                    value.default_value = v;
                }
            );
            // ctx[key] = value.default_value;
        }
    }

    if (!valueGraph.getKeys().length) {
        calculateParameterTopologicalGraph();

        log.info(`Load graph from definition ${definition.definitionId}`);

        const keysHasDependencies = valueGraph.getKeys()
            .map(key => valueGraph.getDependencies(key))
            .filter(d => d.length > 0);

        const depCount = valueGraph.getKeys()
            .map(key => valueGraph.getDependencies(key))
            .reduce((s, deps) => (s + deps.length), 0);

        log.info(`  [value] ${keysHasDependencies.length} parameters have deps, ${depCount} in total.`);


        const keysHasDependencies2 = calculatedValueGraph.getKeys()
            .map(key => calculatedValueGraph.getDependencies(key))
            .filter(d => d.length > 0);

        const depCount2 = calculatedValueGraph.getKeys()
            .map(key => calculatedValueGraph.getDependencies(key))
            .reduce((s, deps) => (s + deps.length), 0);

        log.info(`  [visible] ${keysHasDependencies2.length} parameters have deps, ${depCount2} in total.`);
    }

    allContext[contextKey] = newContext;
    return newContext;
}

/**
 * Get affected parameters.
 *
 */
function getAffectedParameters(dependencyGraph: DependencyGraph, modifiedParameters: string[]): string[] {
    const affectedParametersSet: Set<string> = new Set();

    function handleParameterRecursive(key) {
        if (affectedParametersSet.has(key)) {
            return;
        }

        affectedParametersSet.add(key);

        for (const affectedKey of dependencyGraph.getAffects(key)) {
            handleParameterRecursive(affectedKey);
        }
    }

    for (const key of modifiedParameters) {
        handleParameterRecursive(key);
    }

    const helperArray = Array.from(affectedParametersSet).map(key => ({
        key,
        index: dependencyGraph.getTopologicalOrder(key),
    }));

    return helperArray.sort((a, b) => a.index - b.index).map(item => item.key);
}


interface ParameterResolverOptions {
    contextKey?: string;
}

interface ParameterItem {
    // eslint-disable-next-line camelcase
    default_value: number | string | boolean;
}

export function getParameterItem(key: string): ParameterItem | undefined {
    return parameterMap.get(key);
}

export function applyParameterModifications(definition, modifiedParameterItems: ModifyParameterItem[]) {
    for (const [key, value] of modifiedParameterItems) {
        definition.settings[key].default_value = value;
    }
}

/**
 *
 * @param definition
 * @param modifiedParameterItems
 */
export function resolveParameterValues(definition, modifiedParameterItems: ModifyParameterItem[], options: ParameterResolverOptions = {}) {
    const context = getContext(definition, options?.contextKey);

    // update context before calculating
    for (const key of parameterMap.keys()) {
        if (definition.settings[key]) {
            context.context[key] = definition.settings[key].default_value;
        } else {
            const parameterItem = parameterMap.get(key);
            context.context[key] = parameterItem.default_value;
        }
    }

    // Resolve min, max, visible, mismatch
    for (const [key, parameterItem] of parameterMap) {
        try {
            const defaultValue = definition.settings[key].default_value;

            const visibleValue = parameterItem.visible && context.executeExpression(parameterItem.visible);
            if (!isUndefined(visibleValue)) {
                definition.settings[key].visible = visibleValue;
            }

            const calcValue = parameterItem.calcu_value && context.executeExpression(parameterItem.calcu_value);
            if (parameterItem.type === 'float' || parameterItem.type === 'int') {
                const calcMinValue = parameterItem.min && context.executeExpression(parameterItem.min);
                const calcMaxValue = parameterItem.max && context.executeExpression(parameterItem.max);
                if (!isNil(calcMinValue)) {
                    definition.settings[key].min = calcMinValue;
                }
                if (!isNil(calcMaxValue)) {
                    definition.settings[key].max = calcMaxValue;
                }

                definition.settings[key].mismatch = !isUndefined(calcValue) && Math.abs(calcValue - defaultValue) > 1e-6;
            } else {
                definition.settings[key].mismatch = !isUndefined(calcValue) && calcValue !== defaultValue;
            }
        } catch (e) {
            log.warn(`Unable to resolve calculated values for key ${key} (${definition.definitionId})`);
            log.error(e);
            return;
        }
    }

    const affectedParameters = getAffectedParameters(valueGraph, modifiedParameterItems.map(item => item[0]));

    // calc value & default_value
    for (const key of affectedParameters) {
        const parameterItem = parameterMap.get(key);

        try {
            let defaultValue = definition.settings[key].default_value;

            const calcValue = parameterItem.calcu_value && context.executeExpression(parameterItem.calcu_value);
            if (!isUndefined(calcValue)) {
                if (parameterItem.type === 'float' || parameterItem.type === 'int') {
                    try {
                        defaultValue = Number((calcValue).toFixed(3));
                    } catch (e) {
                        // invalid calculation value
                        log.error(`Invalid calculation value for ${key}, error = ${e}`);
                    }
                } else {
                    defaultValue = calcValue;
                }
            }

            const modifiedParamItem = modifiedParameterItems && modifiedParameterItems.find(item => item[0] === key);
            if (modifiedParamItem) {
                defaultValue = modifiedParamItem[1];
            }

            const calcMinValue = parameterItem.min && context.executeExpression(parameterItem.min);
            const calcMaxValue = parameterItem.max && context.executeExpression(parameterItem.max);
            if (!isUndefined(calcMaxValue) && defaultValue > calcMaxValue) {
                defaultValue = calcMaxValue;
            }
            if (!isUndefined(calcMinValue) && defaultValue < calcMinValue) {
                defaultValue = calcMinValue;
            }

            // Update context and settings
            context.context[key] = defaultValue;
            // if (!skipValues) {
            //    definition.settings[key].default_value = defaultValue;
            // }

            // re calculate mismatch
            if (parameterItem.type === 'float' || parameterItem.type === 'int') {
                if (Math.abs(calcValue - defaultValue) > 1e-6 && !isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            } else {
                if (calcValue !== defaultValue && !isUndefined(calcValue)) {
                    definition.settings[key].mismatch = true;
                } else {
                    definition.settings[key].mismatch = false;
                }
            }
        } catch (e) {
            log.error(e);
            log.error(`key = ${key}`);
        }
    }

    const affectedVisibleParameters = getAffectedParameters(calculatedValueGraph, affectedParameters);

    for (const key of affectedVisibleParameters) {
        const parameterItem = parameterMap.get(key);

        try {
            const visibleValue = parameterItem.visible && context.executeExpression(parameterItem.visible);

            if (!isUndefined(visibleValue)) {
                definition.settings[key].visible = visibleValue;
            }
        } catch (e) {
            log.error(`Failed to calculate visible for ${key}, error: ${e}`);
        }
    }
}


export function resetPresetsContext(): void {
    for (const key of Object.keys(allContext)) {
        delete allContext[key];
    }
}
