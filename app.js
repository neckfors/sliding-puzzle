(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const boardEl = $('board'), sizeSelect = $('sizeSelect');
  const state = { size:4, tiles:[], initial:[], moves:0, seconds:0, started:false, solved:false, history:[], timer:null, sound:true, lastCorrect:new Set(), celebratedRows:new Set(), toastTimer:null };
  const total = () => state.size * state.size - 1;
  const goal = i => i === state.size * state.size - 1 ? 0 : i + 1;
  const isCorrect = (v,i) => v === goal(i);
  const fmt = s => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  const bestKey = () => 'sliding-puzzle-best-' + state.size;
  const best = () => { try { return JSON.parse(localStorage.getItem(bestKey()) || 'null'); } catch { return null; } };
  function sound(freq=600,duration=.09,type='sine',volume=.035) {
    if (!state.sound) return;
    try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const ctx = sound.ctx || (sound.ctx = new C()); const o=ctx.createOscillator(),g=ctx.createGain(); o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.72),ctx.currentTime+duration);g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+duration); } catch {}
  }
  function toast(message) { const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2100); }
  function feedback(message) { $('feedbackText').textContent=message; }
  function startTimer() { if(state.timer || state.solved) return;state.started=true;state.timer=setInterval(()=>{state.seconds++;$('timeValue').textContent=fmt(state.seconds);},1000); }
  function stopTimer() { clearInterval(state.timer);state.timer=null; }
  function updateBest() { const b=best();$('bestValue').textContent=b ? b.moves+' moves' : '—'; }
  function solvedCount() { return state.tiles.reduce((n,v,i)=>n+(v!==0&&isCorrect(v,i)?1:0),0); }
  function rowsDone() { const rows=[];for(let r=0;r<state.size;r++){let ok=true;for(let c=0;c<state.size;c++){const i=r*state.size+c;if(!isCorrect(state.tiles[i],i)){ok=false;break;}}if(ok)rows.push(r);}return rows; }
  function updateProgress() {
    const count=solvedCount(),pct=Math.round(count/total()*100),rows=rowsDone();
    $('progressText').textContent=count+' of '+total()+' tiles in place';$('progressPercent').textContent=pct+'%';$('progressFill').style.width=pct+'%';
    $('movesValue').textContent=state.moves;$('timeValue').textContent=fmt(state.seconds);$('undoBtn').disabled=!state.history.length;
    const doneTile=count>0,doneRow=rows.length>0,donePuzzle=state.solved;
    [['tileMilestone',doneTile],['rowMilestone',doneRow],['puzzleMilestone',donePuzzle]].forEach(([id,done])=>{const el=$(id);el.classList.toggle('done',done);el.querySelector('.milestone-status').textContent=done?'COMPLETED':'IN PROGRESS';});
    $('milestoneCount').textContent=[doneTile,doneRow,donePuzzle].filter(Boolean).length+' / 3';
    updateBest();
  }
  function render(animateCorrect=[], animateMove=true) {
    const previous = new Map();
    if (animateMove) boardEl.querySelectorAll('.tile:not(.empty)').forEach(el => previous.set(Number(el.textContent), el.getBoundingClientRect()));
    boardEl.style.setProperty('--size',state.size);boardEl.innerHTML='';
    state.tiles.forEach((v,i)=>{
      const b=document.createElement('button');b.type='button';b.className='tile'+(v===0?' empty':'')+(v!==0&&isCorrect(v,i)?' correct':'')+(animateCorrect.includes(v)?' just-correct':'');
      b.textContent=v||'';b.setAttribute('aria-label',v===0?'Empty space':'Tile '+v+(isCorrect(v,i)?', correctly placed':''));b.disabled=v===0||state.solved;b.dataset.index=i;b.addEventListener('click',()=>move(i));boardEl.appendChild(b);
      const from=previous.get(v);
      if(v && from && animateMove){
        const to=b.getBoundingClientRect(),dx=from.left-to.left,dy=from.top-to.top;
        if(dx||dy)b.animate([{transform:'translate('+dx+'px,'+dy+'px) scale(1.035)'},{transform:'translate(0,0) scale(1)'}],{duration:230,easing:'cubic-bezier(.2,.85,.25,1)'});
      }
    });
    updateProgress();
  }
  function celebrateRow(row) {
    const tiles=[...boardEl.querySelectorAll('.tile')].filter(el=>Math.floor(Number(el.dataset.index)/state.size)===row);
    tiles.forEach((el,i)=>{el.classList.remove('row-celebrate');void el.offsetWidth;el.style.setProperty('--row-delay',i*38+'ms');el.classList.add('row-celebrate');});
    burstConfetti(26, boardEl.getBoundingClientRect(), 0.55);
  }
  function burstConfetti(count, bounds, power=1) {
    const layer=$('celebrationLayer');if(!layer)return;
    for(let i=0;i<count;i++){
      const p=document.createElement('i');p.className='confetti';
      p.style.left=(bounds.left+bounds.width*(.18+Math.random()*.64))+'px';
      p.style.top=(bounds.top+bounds.height*(.18+Math.random()*.5))+'px';
      p.style.setProperty('--drift',((Math.random()-.5)*240*power)+'px');
      p.style.setProperty('--spin',(Math.random()*900-450)+'deg');
      p.style.setProperty('--fall',(420+Math.random()*480)+'px');
      p.style.setProperty('--hue',Math.floor(Math.random()*360));
      p.style.setProperty('--duration',(850+Math.random()*900)+'ms');
      layer.appendChild(p);p.addEventListener('animationend',()=>p.remove(),{once:true});
    }
  }
  function neighbors(i) { const e=state.tiles.indexOf(0),r=Math.floor(i/state.size),c=i%state.size,er=Math.floor(e/state.size),ec=e%state.size;return Math.abs(r-er)+Math.abs(c-ec)===1; }
  function move(i,fromUndo=false) {
    if(state.solved||!neighbors(i)) return false;
    const empty=state.tiles.indexOf(0),value=state.tiles[i],wasCorrect=isCorrect(value,i);
    if(!fromUndo) state.history.push(state.tiles.slice());
    [state.tiles[i],state.tiles[empty]]=[state.tiles[empty],state.tiles[i]];
    if(!fromUndo) {state.moves++;startTimer();}
    const nowCorrect=isCorrect(value,empty);
    render(nowCorrect&&!wasCorrect?[value]:[]);
    if(nowCorrect&&!wasCorrect){sound(790,.13,'sine',.045);feedback('Yes! Number '+value+' found its place.');toast('✦ Number '+value+' — right where it belongs!');}
    else {sound(440,.055,'triangle',.025);feedback('Nice move. Keep finding your flow.');}
    const rows=rowsDone();
    rows.forEach(r=>{if(!state.celebratedRows.has(r)){state.celebratedRows.add(r);celebrateRow(r);sound(980,.16,'sine',.05);setTimeout(()=>sound(1240,.2,'sine',.045),85);toast('✦ ROW COMPLETE!');feedback('A whole row in place. That feels good.');}});
    if(solvedCount()===total()){win();} else updateProgress();
    return true;
  }
  function shuffle() {
    stopTimer();state.seconds=0;state.moves=0;state.started=false;state.solved=false;state.history=[];state.celebratedRows.clear();state.lastCorrect.clear();
    state.tiles=Array.from({length:state.size*state.size},(_,i)=>i===state.size*state.size-1?0:i+1);
    let prev=-1;const steps=state.size===3?90:state.size===4?180:260;
    for(let n=0;n<steps;n++){const e=state.tiles.indexOf(0),r=Math.floor(e/state.size),c=e%state.size,opts=[];if(r>0)opts.push(e-state.size);if(r<state.size-1)opts.push(e+state.size);if(c>0)opts.push(e-1);if(c<state.size-1)opts.push(e+1);const choices=opts.filter(x=>x!==prev);const pick=choices[Math.floor(Math.random()*choices.length)];prev=e;[state.tiles[e],state.tiles[pick]]=[state.tiles[pick],state.tiles[e]];}
    if(solvedCount()===total()) return shuffle();
    $('winOverlay').hidden=true;boardEl.classList.remove('won');feedback('Your first move is waiting.');render();sound(520,.1,'sine',.025);
  }
  function reset() {
    if(!state.initial.length)return;
    stopTimer();state.tiles=state.initial.slice();state.moves=0;state.seconds=0;state.started=false;state.solved=false;state.history=[];state.celebratedRows.clear();$('winOverlay').hidden=true;boardEl.classList.remove('won');feedback('A fresh start. Take your time.');render();
  }
  function undo() { if(!state.history.length||state.solved)return;state.tiles=state.history.pop();state.moves=Math.max(0,state.moves-1);state.seconds=Math.max(0,state.seconds);render();feedback('One move back. No rush.');sound(340,.07,'triangle',.025); }
  function win() {
    state.solved=true;stopTimer();boardEl.classList.add('won');render();
    const b=best();if(!b||state.moves<b.moves){try{localStorage.setItem(bestKey(),JSON.stringify({moves:state.moves,seconds:state.seconds}));}catch{}}
    $('winSummary').textContent='Solved in '+state.moves+' moves · '+fmt(state.seconds)+'. That was all you.';
    $('winOverlay').hidden=false;feedback('Every tile. Every row. Beautifully done.');toast('✦ PUZZLE COMPLETE! ✦');\n    const frame=$('boardFrame');frame.classList.remove('grand-win');void frame.offsetWidth;frame.classList.add('grand-win');\n    burstConfetti(110,frame.getBoundingClientRect(),1.35);\n    [523,659,784,1047,1319].forEach((hz,i)=>setTimeout(()=>sound(hz,.26,'sine',.055),i*105));
    updateProgress();
  }
  function newSize(size) { state.size=size;state.initial=[];shuffle();state.initial=state.tiles.slice();updateBest(); }
  sizeSelect.addEventListener('change',()=>newSize(Number(sizeSelect.value)));
  $('newGameBtn').addEventListener('click',()=>{newSize(state.size);toast('A new puzzle, just for you.');});
  $('shuffleBtn').addEventListener('click',()=>{newSize(state.size);toast('Shuffled. Let’s find the flow.');});
  $('resetBtn').addEventListener('click',reset);$('undoBtn').addEventListener('click',undo);
  $('playAgainBtn').addEventListener('click',()=>{newSize(state.size);toast('Ready for another?');});
  $('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;$('soundBtn').classList.toggle('active',state.sound);$('soundBtn').textContent=state.sound?'♫':'♪';if(state.sound)sound();});
  $('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('light');try{localStorage.setItem('sliding-puzzle-theme',document.body.classList.contains('light')?'light':'dark');}catch{}});
  document.addEventListener('keydown',e=>{const key=e.key;if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key))return;e.preventDefault();const empty=state.tiles.indexOf(0),r=Math.floor(empty/state.size),c=empty%state.size;let i=-1;if(key==='ArrowUp'&&r<state.size-1)i=empty+state.size;if(key==='ArrowDown'&&r>0)i=empty-state.size;if(key==='ArrowLeft'&&c<state.size-1)i=empty+1;if(key==='ArrowRight'&&c>0)i=empty-1;if(i>=0)move(i);});
  try{if(localStorage.getItem('sliding-puzzle-theme')==='light')document.body.classList.add('light');}catch{}
  newSize(4);state.initial=state.tiles.slice();
  if('serviceWorker' in navigator && location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();