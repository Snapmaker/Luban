
import { NS } from './namespaces';

function flattenNestedGroups(svgRoot) {
    const paths = [];

    function extractPathsFromGroup(group, currentMatrix) {
        const children = group.childNodes;

        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            if (!child.transform || typeof child.transform.baseVal.consolidate !== 'function') {
                // like <text>,
                const text = child.cloneNode(true);
                paths.push(text);
            } else if (child.tagName !== 'g') {
                // 如果是 <path> 元素，将其添加到结果数组
                const path = child.cloneNode(true);

                // 应用矩阵变换
                if (currentMatrix) {
                    const childMatrix = child.transform.baseVal.consolidate() ? child.transform.baseVal.consolidate().matrix : document.createElementNS(NS.SVG, 'svg').createSVGMatrix();
                    const combinedMatrix = currentMatrix.multiply(childMatrix);
                    const transformString = `matrix(${combinedMatrix.a}, ${combinedMatrix.b}, ${combinedMatrix.c}, ${combinedMatrix.d}, ${combinedMatrix.e}, ${combinedMatrix.f})`;
                    path.setAttribute('transform', transformString);
                }

                paths.push(path);
            } else {
                // 如果是 <g> 元素，递归调用函数处理子元素，并传递当前层级的变换矩阵
                const childMatrix = child.transform.baseVal.consolidate() ? child.transform.baseVal.consolidate().matrix : document.createElementNS(NS.SVG, 'svg').createSVGMatrix();
                const combinedMatrix = currentMatrix ? currentMatrix.multiply(childMatrix) : childMatrix;
                extractPathsFromGroup(child, combinedMatrix);
            }
        }
    }

    // 获取 SVG 根元素的初始变换矩阵
    const rootMatrix = svgRoot.createSVGMatrix();

    // 从 SVG 根元素中提取路径元素
    extractPathsFromGroup(svgRoot, rootMatrix);

    // 移除所有的 <g> 元素
    const groups = svgRoot.getElementsByTagName('g');
    for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i];
        group.parentNode.removeChild(group);
    }

    // 将所有 <path> 元素添加到 svgRoot 元素中
    for (const path of paths) {
        svgRoot.appendChild(path);
    }

    return svgRoot;
}

export {
    flattenNestedGroups,
    // convertToSinglePath,
    // extractPathsFromGroup
};
