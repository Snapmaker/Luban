export const pendantSettingsHtml = `
<details id="settings-panel"><summary>Operator settings — fitted tool and obstructions</summary>
<p>These are Luban's shared tool and landmark records. Save the setup you have at the machine; saving disarms jogging and requires a fresh review before arming. No machine movement occurs.</p>
<button type="button" id="reload-settings">Reload saved settings</button>
<h2>Fitted tool</h2><p id="tool-summary"></p>
<form id="tool-form"><label>Protrusion below the toolhead reference (mm) <input id="tool-length" type="number" step="any" min="0.001" required></label>
<p>Enter the fitted tool's conservative protrusion used for clearance. This does not change probe calibration or work zero.</p>
<label>Tool identity <input id="tool-identity" type="text"></label><label>Note <input id="tool-note" type="text"></label>
<button>Confirm fitted tool and disarm</button><button id="clear-tool" type="button">Use conservative fallback</button></form>
<h2>Obstructions</h2><label>Choose a saved obstruction or add one <select id="obstacle-select"></select></label>
<form id="obstacle-form"><label>Name <input id="obstacle-name" type="text" required></label><label>Description <input id="obstacle-description" type="text" required></label>
<div><label>Machine X min <input id="obstacle-x0" type="number" step="any" required></label><label>X max <input id="obstacle-x1" type="number" step="any" required></label></div>
<div><label>Machine Y min <input id="obstacle-y0" type="number" step="any" required></label><label>Y max <input id="obstacle-y1" type="number" step="any" required></label></div>
<label><input id="obstacle-enabled" type="checkbox" checked>Treat this landmark as an obstruction</label>
<div><label>Height describes <select id="obstacle-basis"><option value="physical">Physical top of the obstruction</option><option value="toolhead">Minimum toolhead Z (tool already included)</option></select></label>
<label>Machine Z (mm) <input id="obstacle-height" type="number" step="any" required></label></div>
<p id="obstacle-preview"></p><p>Changing the height basis does not convert the number. For physical top, enter the obstruction's own measured or known height; Luban adds tool protrusion and clearance margin.</p>
<label>Setup note <input id="obstacle-notes" type="text"></label>
<button>Save obstruction and disarm</button><button id="remove-obstacle" type="button" disabled>Remove selected obstruction and disarm</button></form>
<p id="settings-feedback" role="alert" aria-live="assertive" tabindex="-1"></p></details>`;

export const pendantSettingsScript = `
let savedSettings=null,settingsLoaded=false;
const settingsEl=id=>document.getElementById(id);
function settingsFeedback(message){const el=settingsEl('settings-feedback');el.textContent=message;el.focus({preventScroll:true});el.scrollIntoView({block:'nearest'});}
function obstaclePreview(){
  const enabled=settingsEl('obstacle-enabled').checked,basis=settingsEl('obstacle-basis').value,raw=settingsEl('obstacle-height').value;
  settingsEl('obstacle-height').required=enabled;
  const height=Number(raw),tool=savedSettings&&savedSettings.toolProtrusion.mm,margin=savedSettings&&savedSettings.clearanceMarginMm;
  settingsEl('obstacle-preview').textContent=!enabled?'This landmark will not exclude jogging.':raw===''||!Number.isFinite(height)?'Enter the machine Z height.':basis==='physical'&&tool===null?'Tool protrusion is unknown: this footprint will be excluded at all heights.':'Required machine toolhead Z: '+(basis==='physical'?height+tool+margin:height).toFixed(3)+' mm. A 5 mm XY margin is also applied.';
}
function selectObstacle(){
  const item=savedSettings&&savedSettings.landmarks.find(l=>l.id===settingsEl('obstacle-select').value);
  settingsEl('obstacle-name').value=item?item.name:'';settingsEl('obstacle-description').value=item?item.description:'';
  for(const key of ['x0','x1','y0','y1'])settingsEl('obstacle-'+key).value=item?item.machine[key]:'';
  settingsEl('obstacle-enabled').checked=item?item.clearanceZ!==null:true;
  settingsEl('obstacle-basis').value=item?item.clearanceBasis:'physical';settingsEl('obstacle-height').value=item&&item.clearanceZ!==null?item.clearanceZ:'';
  settingsEl('obstacle-notes').value=item?item.notes||'':'';settingsEl('remove-obstacle').disabled=!item;obstaclePreview();
}
function renderSettings(info,force=false){
  if(!info)return;savedSettings=info;
  const tool=info.activeTool.active,stored=info.activeTool.stored,effective=info.toolProtrusion;
  settingsEl('tool-summary').textContent=(tool?'Confirmed fitted tool: '+tool.protrusionMm+' mm. ':stored?'Previous tool: '+stored.protrusionMm+' mm; confirmation needed. ':'No fitted tool confirmed. ')+(info.activeTool.staleReason||'')+' Clearance currently uses '+(effective.mm===null?'unknown protrusion':effective.mm+' mm ('+effective.source+')')+'.';
  if(!settingsLoaded||force){
    const shown=tool||stored;settingsEl('tool-length').value=shown?shown.protrusionMm:'';settingsEl('tool-identity').value=shown?shown.toolIdentity||'':'';settingsEl('tool-note').value=shown?shown.note||'':'';
    const select=settingsEl('obstacle-select'),previous=select.value;select.textContent='';const add=document.createElement('option');add.value='';add.textContent='Add new obstruction';select.appendChild(add);
    for(const item of info.landmarks){const option=document.createElement('option');option.value=item.id;option.textContent=item.name+(item.clearanceZ===null?' (not an obstruction)':'');select.appendChild(option);}
    select.value=info.landmarks.some(item=>item.id===previous)?previous:'';settingsLoaded=true;selectObstacle();
  }else obstaclePreview();
}
async function saveSettings(body){
  try{await post('settings',body);settingsLoaded=false;await refresh();if(body.kind==='obstacle'&&savedSettings){const item=savedSettings.landmarks.find(l=>l.name===body.name);if(item){settingsEl('obstacle-select').value=item.id;selectObstacle();}}settingsEl('clear').checked=false;settingsFeedback('Saved. Jogging is disarmed. Review the recalculated clearances before arming.');}
  catch(error){await refresh();settingsFeedback(error.message);}
}
settingsEl('reload-settings').onclick=()=>renderSettings(savedSettings,true);
settingsEl('obstacle-select').onchange=selectObstacle;
for(const id of ['obstacle-enabled','obstacle-basis','obstacle-height'])settingsEl(id).oninput=obstaclePreview;
settingsEl('tool-form').onsubmit=async event=>{event.preventDefault();await saveSettings({kind:'tool',protrusionMm:Number(settingsEl('tool-length').value),toolIdentity:settingsEl('tool-identity').value,note:settingsEl('tool-note').value});};
settingsEl('clear-tool').onclick=()=>saveSettings({kind:'clear-tool'});
settingsEl('obstacle-form').onsubmit=async event=>{event.preventDefault();const body={kind:'obstacle',id:settingsEl('obstacle-select').value,name:settingsEl('obstacle-name').value,description:settingsEl('obstacle-description').value,enabled:settingsEl('obstacle-enabled').checked,clearanceBasis:settingsEl('obstacle-basis').value,clearanceZ:Number(settingsEl('obstacle-height').value),notes:settingsEl('obstacle-notes').value};for(const key of ['x0','x1','y0','y1'])body[key]=Number(settingsEl('obstacle-'+key).value);await saveSettings(body);};
settingsEl('remove-obstacle').onclick=()=>saveSettings({kind:'remove-obstacle',id:settingsEl('obstacle-select').value});
for(const id of ['tool-form','obstacle-form'])settingsEl(id).addEventListener('invalid',()=>settingsFeedback('Complete the required setup fields before saving.'),true);
`;
