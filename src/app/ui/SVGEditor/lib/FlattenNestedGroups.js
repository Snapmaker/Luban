
function extractPathsFromGroup(group, transform) {
    let paths = [];
    const children = group.childNodes;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (child.tagName !== 'g') {
            // 如果是 <path> 元素，将其添加到结果数组
            const path = child.cloneNode();

            // 合并变换属性
            if (transform && child.getAttribute) {
                const childTransform = child.getAttribute('transform');
                if (childTransform) {
                    path.setAttribute('transform', `${transform} ${childTransform}`);
                } else {
                    path.setAttribute('transform', transform);
                }
            }

            paths.push(path);
        } else if (child.tagName === 'g') {
            // 如果是 <g> 元素，递归调用函数处理子元素
            const childTransform = child.getAttribute('transform');
            const combinedTransform = transform ? `${transform} ${childTransform}` : childTransform;
            const childPaths = extractPathsFromGroup(child, combinedTransform);
            paths = paths.concat(childPaths);
        }
    }

    return paths;
}

function convertToSinglePath(svgGroup) {
    const groupTransform = svgGroup.getAttribute('transform');
    const groupX = parseFloat(svgGroup.getAttribute('x'));
    const groupY = parseFloat(svgGroup.getAttribute('y'));

    const pathElement = svgGroup.querySelector('path');
    const pathTransform = pathElement.getAttribute('transform');
    const pathX = parseFloat(pathElement.getAttribute('x'));
    const pathY = parseFloat(pathElement.getAttribute('y'));

    const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const combinedTransform = groupTransform ? `${groupTransform} ${pathTransform}` : pathTransform;
    newPath.setAttribute('transform', combinedTransform);
    newPath.setAttribute('d', pathElement.getAttribute('d'));

    // 计算新的位置
    const newX = groupX + pathX;
    const newY = groupY + pathY;
    newPath.setAttribute('x', newX);
    newPath.setAttribute('y', newY);

    // 获取变换矩阵并应用到新的路径元素上
    const groupMatrix = svgGroup.getCTM();
    const pathMatrix = pathElement.getCTM();
    const combinedMatrix = groupMatrix.multiply(pathMatrix);
    newPath.setAttribute('transform', `matrix(${combinedMatrix.a}, ${combinedMatrix.b}, ${combinedMatrix.c}, ${combinedMatrix.d}, ${combinedMatrix.e}, ${combinedMatrix.f})`);

    // 替换原先的 <g> 元素
    svgGroup.parentNode.replaceChild(newPath, svgGroup);
}

function flattenNestedGroups(svgRoot) {
    const groups = svgRoot.getElementsByTagName('g');

    for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i];

        // 检查是否是包含单个 <path> 元素的 <g> 元素
        // const pathElement = group.querySelector('path');
        // if (pathElement && group.childElementCount === 1) {
        //     convertToSinglePath(group);
        // } else {
        // 展开多层嵌套的 <g> 元素和 <path> 元素
        const transform = group.getAttribute('transform');
        const paths = extractPathsFromGroup(group, transform);

        // 在父级节点后插入提取的 <path> 元素
        for (let j = paths.length - 1; j >= 0; j--) {
            group.parentNode.insertBefore(paths[j], group.nextSibling);
        }

        // 移除原先的 <g> 元素
        group.parentNode.removeChild(group);
        // }
    }
}

export {
    flattenNestedGroups,
    convertToSinglePath,
    extractPathsFromGroup
};
