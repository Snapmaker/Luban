const {
    remote,
    ipcRenderer
} = require('electron');
// 访问window对象
window.isClient = true;

// 操作dom
const div = document.createElement('div');
div.innerText = 'I am a div';

const p = document.createElement('p');
p.innerText = '注意打开控制台';

document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(div);
    document.body.appendChild(p);
});
