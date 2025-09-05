
const ui = {
  video: document.getElementById('video'),
  canvas: document.getElementById('overlay'),
  ctx: null,
  toggles: { earrings:false, necklace:false, nosepin:false },
  selects: {
    earStyle: document.getElementById('earStyle'),
    neckStyle: document.getElementById('neckStyle'),
    noseStyle: document.getElementById('noseStyle'),
    scaleBoost: document.getElementById('scaleBoost'),
  },
  files: {
    earImg: document.getElementById('earImg'),
    neckImg: document.getElementById('neckImg'),
    noseImg: document.getElementById('noseImg'),
  },
  status: {
    camDot: document.getElementById('camDot'),
    camStatus: document.getElementById('camStatus'),
    wsDot: document.getElementById('wsDot'),
    wsStatus: document.getElementById('wsStatus'),
    faceDot: document.getElementById('faceDot'),
    faceStatus: document.getElementById('faceStatus'),
  }
};

const setDot = (el, cls, textEl, text)=>{ el.className='dot '+cls; if(textEl&&text) textEl.textContent=text; };

function fitCanvas(){ ui.canvas.width = ui.video.videoWidth; ui.canvas.height = ui.video.videoHeight; ui.ctx = ui.canvas.getContext('2d'); }

async function initCamera(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video:{facingMode:'user', width:{ideal:1280}, height:{ideal:720}}, audio:false });
    ui.video.srcObject = stream; await ui.video.play(); fitCanvas();
    setDot(ui.status.camDot, 'ok', ui.status.camStatus, 'Camera: ready');
  }catch(e){ console.error(e); setDot(ui.status.camDot,'err', ui.status.camStatus, 'Camera: denied'); }
}

// WebSocket to Python
let ws = null;
function initWS(){
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(proto + '://' + location.host + '/ws');
  ws.onopen = ()=> setDot(ui.status.wsDot, 'ok', ui.status.wsStatus, 'WS: connected');
  ws.onclose = ()=> setDot(ui.status.wsDot, 'warn', ui.status.wsStatus, 'WS: closed');
  ws.onerror = ()=> setDot(ui.status.wsDot, 'err', ui.status.wsStatus, 'WS: error');
  ws.onmessage = onWSMessage;
}

let latestPositions = null;
function onWSMessage(ev){
  const data = JSON.parse(ev.data);
  if(data.error){ console.warn('Server error:', data.error); return; }
  if(!data.face){ setDot(ui.status.faceDot, 'warn', ui.status.faceStatus, 'Face: not found'); latestPositions=null; return; }
  setDot(ui.status.faceDot, 'ok', ui.status.faceStatus, 'Face: detected');
  latestPositions = data;
}

function drawStud(x,y,size){
  const ctx = ui.ctx; ctx.save(); ctx.translate(x,y); ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2);
  ctx.fillStyle='rgba(245,220,120,0.95)'; ctx.fill(); ctx.lineWidth=Math.max(1,size*0.08); ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.stroke(); ctx.restore();
}
function drawHoop(x,y,size){
  const ctx = ui.ctx; ctx.save(); ctx.translate(x,y); ctx.beginPath(); ctx.lineWidth=Math.max(1,size*0.12); ctx.strokeStyle='rgba(230,210,160,0.95)'; ctx.arc(0,0,size*0.6,Math.PI*0.15,Math.PI*1.85); ctx.stroke(); ctx.restore();
}
function drawDrop(x,y,size){
  const ctx = ui.ctx; ctx.save(); ctx.translate(x,y); ctx.beginPath(); ctx.moveTo(0,-size*0.15); ctx.quadraticCurveTo(size*0.25,size*0.15,0,size*0.55); ctx.quadraticCurveTo(-size*0.25,size*0.15,0,-size*0.15); ctx.closePath();
  const g = ctx.createRadialGradient(0,0,1, 0,0,size*0.55); g.addColorStop(0,'rgba(255,255,255,0.9)'); g.addColorStop(1,'rgba(255,200,120,0.95)'); ui.ctx.fillStyle=g; ui.ctx.fill(); ui.ctx.restore();
}
function drawPearl(x,y,r){
  const ctx = ui.ctx; ctx.save(); ctx.translate(x,y); const g = ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.1, 0,0,r); g.addColorStop(0,'rgba(255,255,255,0.95)'); g.addColorStop(1,'rgba(230,235,245,0.95)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); ctx.restore();
}

function drawNecklace(center, faceW, style){
  const ctx = ui.ctx; const scale = Number(ui.selects.scaleBoost.value);
  const w = faceW * 0.95 * scale; const h = Math.max(16, faceW*0.22); const y = center.y + faceW*0.08; const x = center.x;
  ctx.save(); ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.bezierCurveTo(x-w*0.25,y+h,x+w*0.25,y+h,x+w/2,y); ctx.lineWidth=Math.max(2, faceW*0.02); ctx.strokeStyle='rgba(240,215,150,0.95)'; ctx.stroke();
  if(style==='pearl'){ const beads=18; for(let i=0;i<=beads;i++){ const t=i/beads; const px=cubicBezier(x-w/2,x-w*0.25,x+w*0.25,x+w/2,t); const py=cubicBezier(y,y+h,y+h,y,t); drawPearl(px,py,Math.max(2, faceW*0.018)); } }
  if(style==='pendant'){ const px=x, py=y+h*0.88; drawDrop(px,py,Math.max(16, faceW*0.12)); }
  ctx.restore();
}
function cubicBezier(p0,p1,p2,p3,t){ const mt=1-t; return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3; }

function drawNose(nose, faceW, style){
  const scale = Number(ui.selects.scaleBoost.value); const s = Math.max(4, faceW*0.035)*scale;
  if(style==='dot') return drawStud(nose.x, nose.y, s*0.6);
  if(style==='stud') return drawStud(nose.x, nose.y, s);
  if(style==='ring'){
    const ctx = ui.ctx; ctx.save(); ctx.translate(nose.x + s*0.25, nose.y + s*0.05); ctx.beginPath(); ctx.lineWidth=Math.max(1.5, s*0.18); ctx.strokeStyle='rgba(240,215,150,0.95)'; ctx.arc(0,0,s*0.6,Math.PI*0.1,Math.PI*1.2); ctx.stroke(); ctx.restore();
  }
}

function drawEarrings(anchors, faceW, style){
  const scale = Number(ui.selects.scaleBoost.value); const size = Math.max(18, faceW*0.14)*scale;
  for(const p of anchors){
    const x=p.x, y=p.y+faceW*0.02;
    if(window._earImg){ ui.ctx.drawImage(window._earImg, x-size/2, y-size/2, size, size); }
    else { if(style==='stud') drawStud(x,y,size*0.5); if(style==='hoop') drawHoop(x,y,size); if(style==='drop') drawDrop(x,y,size); }
  }
}

function fileToImage(inputEl, key){
  inputEl.addEventListener('change', ()=>{
    const f = inputEl.files?.[0]; if(!f) { window[key]=null; return; }
    const url = URL.createObjectURL(f); const img = new Image(); img.onload=()=>{ window[key]=img; }; img.src = url;
  });
}

function snapshot(){
  const tmp = document.createElement('canvas'); tmp.width = ui.canvas.width; tmp.height = ui.canvas.height; const t = tmp.getContext('2d');
  t.save(); t.translate(tmp.width,0); t.scale(-1,1); t.drawImage(ui.video,0,0,tmp.width,tmp.height); t.restore();
  t.drawImage(ui.canvas,0,0);
  const link = document.createElement('a'); link.download = `jewelry_tryon_${Date.now()}.png`; link.href = tmp.toDataURL('image/png'); link.click();
}

function initUI(){
  document.querySelectorAll('[data-toggle]').forEach(btn=>{
    const key = btn.dataset.toggle; btn.addEventListener('click', ()=>{ ui.toggles[key] = !ui.toggles[key]; btn.classList.toggle('active', ui.toggles[key]); });
  });
  document.getElementById('snapshot').addEventListener('click', snapshot);
  fileToImage(ui.files.earImg, '_earImg');
  fileToImage(ui.files.neckImg, '_neckImg');
  fileToImage(ui.files.noseImg, '_noseImg');
}

// send frames to server at ~10 fps
function startFrameSender(){
  const hidden = document.createElement('canvas'); const hctx = hidden.getContext('2d');
  function tick(){
    if(!ws || ws.readyState !== WebSocket.OPEN || ui.video.readyState < 2){ requestAnimationFrame(tick); return; }
    hidden.width = ui.video.videoWidth; hidden.height = ui.video.videoHeight;
    hctx.save(); hctx.translate(hidden.width,0); hctx.scale(-1,1); // mirror so server sees unmirrored coords later if needed
    hctx.drawImage(ui.video, 0,0, hidden.width, hidden.height);
    hctx.restore();
    const dataURL = hidden.toDataURL('image/jpeg', 0.6);
    ws.send(JSON.stringify({image: dataURL}));
    setTimeout(()=>requestAnimationFrame(tick), 100); // ~10 fps
  }
  tick();
}

// render overlays
function render(){
  const ctx = ui.ctx; if(!ctx){ requestAnimationFrame(render); return; }
  ctx.clearRect(0,0, ui.canvas.width, ui.canvas.height);
  if(latestPositions){
    const M = latestPositions;
    // Necklace
    if(ui.toggles.necklace){
      if(window._neckImg){
        const w = M.faceW * 1.1 * Number(ui.selects.scaleBoost.value);
        const h = w * 0.35;
        ctx.drawImage(window._neckImg, M.chin.x - w/2, M.chin.y + M.faceW*0.02, w, h);
      } else {
        const center = M.chin; drawNecklace(center, M.faceW, ui.selects.neckStyle.value);
      }
    }
    // Earrings
    if(ui.toggles.earrings){
      drawEarrings([M.leftEar, M.rightEar], M.faceW, ui.selects.earStyle.value);
    }
    // Nose pin
    if(ui.toggles.nosepin){
      if(window._noseImg){
        const s = Math.max(12, M.faceW*0.08) * Number(ui.selects.scaleBoost.value);
        ctx.drawImage(window._noseImg, M.nose.x - s/2, M.nose.y - s/2, s, s);
      } else {
        drawNose(M.nose, M.faceW, ui.selects.noseStyle.value);
      }
    }
  }
  requestAnimationFrame(render);
}

(async function boot(){
  initUI();
  await initCamera();
  initWS();
  startFrameSender();
  render();
  window.addEventListener('resize', fitCanvas);
})();
